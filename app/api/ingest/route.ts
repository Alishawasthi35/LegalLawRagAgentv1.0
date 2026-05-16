/**
 * On-demand ingestion endpoint.
 * Pass a JSON body { ik_doc_id: "12345" } and we'll fetch the IK doc,
 * chunk it, embed it, and store it in pgvector.
 *
 * Intended to be called as a fire-and-forget after the agent has shown
 * answers that referenced a not-yet-indexed IK doc.
 */
import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { geminiEmbedBatch } from "@/lib/gemini";
import { ikDoc, ikStripHtml, ikUrl } from "@/lib/indiankanoon";
import { chunkJudgment } from "@/lib/chunking";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  const auth = req.headers.get("authorization");
  if (!auth || !auth.includes(process.env.CRON_SECRET || "__never__")) {
    // For human-triggered ingest, we also accept the session cookie elsewhere.
    // For now, gate behind CRON_SECRET to prevent abuse.
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { ik_doc_id } = await req.json();
  if (!ik_doc_id) return NextResponse.json({ error: "missing ik_doc_id" }, { status: 400 });

  const service = createServiceClient();

  // Skip if already ingested.
  const { data: existing } = await service
    .from("cases")
    .select("id")
    .eq("ik_doc_id", String(ik_doc_id))
    .maybeSingle();
  if (existing) return NextResponse.json({ ok: true, status: "exists", case_id: existing.id });

  // Mark a job.
  await service
    .from("ingestion_jobs")
    .upsert({ ik_doc_id: String(ik_doc_id), status: "running", attempts: 1 }, { onConflict: "ik_doc_id" });

  try {
    const doc = await ikDoc(Number(ik_doc_id), { maxcites: 5, maxcitedby: 5 });
    const plain = ikStripHtml(doc.doc || "");
    if (!plain || plain.length < 200) {
      throw new Error("doc too short");
    }

    const { data: caseRow, error: caseErr } = await service
      .from("cases")
      .insert({
        ik_doc_id: String(doc.tid),
        title: doc.title,
        court: doc.docsource,
        bench: doc.bench,
        decision_date: doc.publishdate ? doc.publishdate.slice(0, 10) : null,
        citation: doc.citation,
        url: ikUrl(doc.tid),
        full_text: plain.length < 50_000 ? plain : null,
        metadata: { numcites: doc.numcites, numcitedby: doc.numcitedby }
      })
      .select("id")
      .single();
    if (caseErr) throw caseErr;
    const caseId = caseRow.id;

    const chunks = chunkJudgment(plain);
    // Embed in batches of 50.
    for (let i = 0; i < chunks.length; i += 50) {
      const batch = chunks.slice(i, i + 50);
      const embeddings = await geminiEmbedBatch(batch.map((c) => c.text));
      const rows = batch.map((c, j) => ({
        case_id: caseId,
        chunk_text: c.text,
        para_number: c.paraStart,
        token_count: c.tokenCount,
        embedding: embeddings[j] as unknown as string
      }));
      const { error } = await service.from("case_chunks").insert(rows);
      if (error) throw error;
    }

    await service
      .from("ingestion_jobs")
      .update({ status: "done", updated_at: new Date().toISOString() })
      .eq("ik_doc_id", String(ik_doc_id));

    return NextResponse.json({ ok: true, case_id: caseId, chunks: chunks.length });
  } catch (err: any) {
    await service
      .from("ingestion_jobs")
      .update({ status: "failed", error: String(err?.message ?? err), updated_at: new Date().toISOString() })
      .eq("ik_doc_id", String(ik_doc_id));
    return NextResponse.json({ error: err?.message ?? "ingest failed" }, { status: 500 });
  }
}
