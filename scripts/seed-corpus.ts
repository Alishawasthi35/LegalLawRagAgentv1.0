/**
 * One-time: fetch a curated list of landmark Indian judgments from IndianKanoon,
 * chunk + embed + insert into pgvector. This is the initial seed of the corpus.
 *
 * Run:  npm run seed:corpus
 */
import { readFileSync } from "fs";
import path from "path";
import { createServiceClient } from "@/lib/supabase/service";
import { geminiEmbedBatch } from "@/lib/gemini";
import { ikDoc, ikStripHtml, ikUrl } from "@/lib/indiankanoon";
import { chunkJudgment } from "@/lib/chunking";

async function main() {
  const list = JSON.parse(
    readFileSync(path.join(process.cwd(), "scripts", "landmark-cases.json"), "utf-8")
  ) as Array<{ ik_doc_id: string; title: string }>;
  console.log(`Seeding ${list.length} landmark cases`);

  const supabase = createServiceClient();

  for (const item of list) {
    const { data: exists } = await supabase
      .from("cases")
      .select("id")
      .eq("ik_doc_id", item.ik_doc_id)
      .maybeSingle();
    if (exists) {
      console.log(`skip: ${item.title} (already present)`);
      continue;
    }

    console.log(`fetch: ${item.title}`);
    let doc;
    try {
      doc = await ikDoc(Number(item.ik_doc_id), { maxcites: 10, maxcitedby: 10 });
    } catch (e: any) {
      console.warn(`  failed: ${e.message}`);
      continue;
    }
    const plain = ikStripHtml(doc.doc || "");
    if (plain.length < 200) {
      console.warn(`  too short, skipping`);
      continue;
    }

    const { data: caseRow, error: caseErr } = await supabase
      .from("cases")
      .insert({
        ik_doc_id: String(doc.tid),
        title: doc.title || item.title,
        court: doc.docsource || "Supreme Court of India",
        bench: doc.bench || null,
        decision_date: doc.publishdate ? doc.publishdate.slice(0, 10) : null,
        citation: doc.citation || null,
        url: ikUrl(doc.tid),
        full_text: plain.length < 50_000 ? plain : null,
        metadata: { numcites: doc.numcites, numcitedby: doc.numcitedby }
      })
      .select("id")
      .single();
    if (caseErr) {
      console.warn(`  insert failed: ${caseErr.message}`);
      continue;
    }
    const caseId = caseRow.id;

    const chunks = chunkJudgment(plain);
    console.log(`  ${chunks.length} chunks`);
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
      const { error } = await supabase.from("case_chunks").insert(rows);
      if (error) console.warn(`  chunk insert failed: ${error.message}`);
    }
  }
  console.log("Done.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
