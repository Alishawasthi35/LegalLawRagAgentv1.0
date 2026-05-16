/**
 * Nightly cron: pull yesterday's reportable Supreme Court judgments from
 * IndianKanoon (filtered by date + docsource), enqueue ingestion of any
 * that aren't already in the corpus.
 *
 * Schedule via vercel.json:  "0 21 * * *" (03:00 IST).
 */
import { NextResponse } from "next/server";
import { ikSearch } from "@/lib/indiankanoon";
import { createServiceClient } from "@/lib/supabase/service";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const auth = req.headers.get("authorization") || "";
  if (!auth.includes(process.env.CRON_SECRET || "__never__")) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000)
    .toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" })
    .replace(/\//g, "-");

  try {
    const res = await ikSearch("doctypes:supremecourt", {
      fromdate: yesterday,
      todate: yesterday,
      maxpages: 2
    });

    const service = createServiceClient();
    let queued = 0;
    for (const hit of res.docs ?? []) {
      const { data: exists } = await service
        .from("cases")
        .select("id")
        .eq("ik_doc_id", String(hit.tid))
        .maybeSingle();
      if (exists) continue;

      await service.from("ingestion_jobs").upsert(
        { ik_doc_id: String(hit.tid), status: "pending", attempts: 0 },
        { onConflict: "ik_doc_id" }
      );
      queued++;
    }

    return NextResponse.json({ ok: true, found: res.found, queued });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "cron failed" }, { status: 500 });
  }
}
