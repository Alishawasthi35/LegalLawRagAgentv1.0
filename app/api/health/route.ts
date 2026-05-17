import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { geminiText } from "@/lib/gemini";
import { groqText, groqAvailable } from "@/lib/groq";
import { ikSearch, indianKanoonConfigured } from "@/lib/indiankanoon";
import { tavilySearch, tavilyAvailable } from "@/lib/tavily";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Check {
  name: string;
  configured: boolean;
  ok: boolean;
  detail?: string;
  latency_ms?: number;
}

export async function GET() {
  const results: Check[] = [];

  // Supabase
  results.push(await time("supabase", true, async () => {
    const sb = createServiceClient();
    const { error } = await sb.from("statutes").select("id", { head: true, count: "exact" }).limit(1);
    if (error) throw new Error(error.message);
    return "connected";
  }));

  // Gemini
  results.push(await time("gemini", Boolean(process.env.GOOGLE_API_KEY), async () => {
    const r = await geminiText("Reply with the single word: ok", { maxOutputTokens: 8, temperature: 0 });
    return r.slice(0, 30);
  }));

  // Groq (optional fallback)
  results.push(await time("groq", groqAvailable(), async () => {
    const r = await groqText("Reply with the single word: ok");
    return r.slice(0, 30);
  }));

  // IndianKanoon
  results.push(await time("indiankanoon", indianKanoonConfigured(), async () => {
    const r = await ikSearch("test", { pagenum: 0, maxpages: 1 });
    return `${r.found ?? 0} results for probe`;
  }));

  // Tavily (optional 4th retriever)
  results.push(await time("tavily", tavilyAvailable(), async () => {
    const r = await tavilySearch("Indian constitution", { max_results: 1 });
    return `${r.length} probe results`;
  }));

  const overall = results.every((r) => !r.configured || r.ok) ? "healthy" : "degraded";
  return NextResponse.json({ status: overall, checks: results, time: new Date().toISOString() });
}

async function time(name: string, configured: boolean, fn: () => Promise<string>): Promise<Check> {
  if (!configured) return { name, configured: false, ok: false, detail: "not configured" };
  const t = Date.now();
  try {
    const detail = await fn();
    return { name, configured: true, ok: true, detail, latency_ms: Date.now() - t };
  } catch (err: any) {
    return { name, configured: true, ok: false, detail: err?.message ?? "failed", latency_ms: Date.now() - t };
  }
}
