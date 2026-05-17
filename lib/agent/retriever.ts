import { createServiceClient } from "@/lib/supabase/service";
import { geminiEmbed } from "@/lib/gemini";
import {
  ikSearch,
  ikDoc,
  ikStripHtml,
  ikUrl,
  indianKanoonConfigured,
  type IKSearchHit
} from "@/lib/indiankanoon";
import { tavilySearch, tavilyAvailable, INDIAN_LEGAL_DOMAINS } from "@/lib/tavily";
import type { AgentPlan, RetrievedChunk } from "@/lib/types";

const MAX_CHUNKS_PER_SUBQ = 10;
const MAX_IK_HITS_PER_SUBQ = 6;
const IK_BODY_MAX_BYTES = 80_000;       // fetch up to ~80KB even for big docs
const IK_BODY_KEEP_CHARS = 3500;        // pull a substantial slice for context

/**
 * Run hybrid retrieval against (a) pgvector corpus, (b) IndianKanoon live API,
 * (c) statutes table. Results are deduped by (case_title + para) where possible.
 */
export async function retrieve(plan: AgentPlan): Promise<RetrievedChunk[]> {
  const supabase = createServiceClient();
  const all: RetrievedChunk[] = [];
  const seen = new Set<string>();

  // 1) Bare-act lookups for any statute the planner identified.
  await Promise.all(
    plan.statutes.map(async (s) => {
      const parsed = parseStatuteRef(s);
      if (!parsed) return;
      const { data, error } = await supabase
        .from("statutes")
        .select("id, act, act_short, section, subsection, heading, text, in_force")
        .or(`act_short.ilike.${parsed.act_short},act.ilike.%${parsed.act_short}%`)
        .ilike("section", parsed.section)
        .limit(3);
      if (error || !data) return;
      for (const row of data) {
        const key = `statute:${row.act_short}:${row.section}`;
        if (seen.has(key)) continue;
        seen.add(key);
        all.push({
          chunk_id: row.id,
          source: "statute",
          case_title: `${row.act_short} §${row.section}${row.subsection ? `(${row.subsection})` : ""}`,
          citation: row.act,
          text: row.text,
          url: undefined
        });
      }
    })
  );

  // 2) For each sub-question, run pgvector + IK + Tavily in parallel.
  await Promise.all(
    plan.sub_questions.map(async (sq) => {
      const [pg, ik, web] = await Promise.all([
        pgvectorSearch(supabase, sq, plan),
        indianKanoonConfigured() ? indianKanoonSearch(sq, plan) : Promise.resolve([]),
        tavilyAvailable() ? tavilyWebSearch(sq) : Promise.resolve([])
      ]);
      for (const c of pg.concat(ik).concat(web)) {
        const key = c.case_title
          ? `${c.case_title}:${c.para_number ?? c.text.slice(0, 60)}`
          : c.text.slice(0, 80);
        if (seen.has(key)) continue;
        seen.add(key);
        all.push(c);
      }
    })
  );

  return all;
}

function parseStatuteRef(s: string): { act_short: string; section: string } | null {
  // accept "CrPC §438", "IPC 302", "Section 138 NI Act", "Art 21 Constitution"
  const cleaned = s.replace(/§|sec\.?|section/gi, " ").replace(/\s+/g, " ").trim();
  const m =
    cleaned.match(/^(BNS|BNSS|BSA|IPC|CrPC|CPC|IEA|NI|Constitution|Companies|IT|Arbitration)\s*(\d+[A-Za-z]?)/i) ||
    cleaned.match(/(\d+[A-Za-z]?)\s+(BNS|BNSS|BSA|IPC|CrPC|CPC|IEA|NI|Constitution|Companies|IT|Arbitration)/i);
  if (!m) return null;
  if (m[1].match(/^\d/)) return { act_short: m[2].toUpperCase(), section: m[1] };
  return { act_short: m[1].toUpperCase(), section: m[2] };
}

async function pgvectorSearch(
  sb: ReturnType<typeof createServiceClient>,
  question: string,
  plan: AgentPlan
): Promise<RetrievedChunk[]> {
  let embedding: number[];
  try {
    embedding = await geminiEmbed(question);
  } catch {
    return [];
  }

  const minDate =
    plan.recency_window_days && plan.recency_window_days > 0
      ? new Date(Date.now() - plan.recency_window_days * 24 * 60 * 60 * 1000)
          .toISOString()
          .slice(0, 10)
      : null;

  const { data, error } = await sb.rpc("match_case_chunks", {
    query_embedding: embedding,
    match_count: MAX_CHUNKS_PER_SUBQ,
    similarity_threshold: 0.30,    // lower threshold = higher recall
    court_filter: plan.jurisdictions && plan.jurisdictions.length === 1 ? plan.jurisdictions[0] : null,
    min_date: minDate
  });
  if (error || !data) return [];
  return data.map((row: any): RetrievedChunk => ({
    chunk_id: row.chunk_id,
    source: "pgvector",
    case_id: row.case_id,
    case_title: row.case_title,
    citation: row.citation,
    court: row.court,
    decision_date: row.decision_date,
    para_number: row.para_number,
    text: row.chunk_text,
    similarity: row.similarity,
    url: row.url
  }));
}

async function tavilyWebSearch(question: string): Promise<RetrievedChunk[]> {
  // Bias the search toward Indian legal commentary domains.
  const queryWithContext = `Indian law: ${question}`;
  const results = await tavilySearch(queryWithContext, {
    max_results: 4,
    include_domains: INDIAN_LEGAL_DOMAINS,
    search_depth: "basic"
  });
  return results.map((r, i): RetrievedChunk => ({
    chunk_id: `web:${i}:${r.url}`,
    source: "web",
    case_title: r.title,
    text: r.content,
    url: r.url,
    decision_date: r.published_date
  }));
}

async function indianKanoonSearch(question: string, plan: AgentPlan): Promise<RetrievedChunk[]> {
  let hits: IKSearchHit[] = [];
  try {
    const fromdate =
      plan.recency_window_days && plan.recency_window_days > 0
        ? new Date(Date.now() - plan.recency_window_days * 24 * 60 * 60 * 1000)
            .toLocaleDateString("en-IN", { day: "2-digit", month: "2-digit", year: "numeric" })
            .replace(/\//g, "-")
        : undefined;
    const res = await ikSearch(question, { pagenum: 0, fromdate, maxpages: 1 });
    hits = (res.docs || []).slice(0, MAX_IK_HITS_PER_SUBQ);
  } catch {
    return [];
  }

  // For each hit, prefer the snippet (`headline` or `fragment`); only deep-fetch
  // small docs to stay within IK budget and serverless timeouts.
  const chunks: RetrievedChunk[] = [];
  for (const h of hits) {
    const headline = (h.headline || h.fragment || "").replace(/<[^>]+>/g, "").trim();
    chunks.push({
      chunk_id: `ik:${h.tid}:snippet`,
      source: "indiankanoon",
      ik_doc_id: String(h.tid),
      case_title: h.title,
      court: h.docsource,
      decision_date: h.publishdate,
      text: headline || h.title,
      url: ikUrl(h.tid)
    });

    // Aggressively fetch doc body for ALL hits up to a size cap — small slices
    // of the actual judgment beat headlines for grounded synthesis.
    if (h.docsize && h.docsize < IK_BODY_MAX_BYTES) {
      try {
        const doc = await ikDoc(h.tid, { maxcites: 5, maxcitedby: 5 });
        const plain = ikStripHtml(doc.doc || "");
        if (plain) {
          chunks.push({
            chunk_id: `ik:${h.tid}:body`,
            source: "indiankanoon",
            ik_doc_id: String(h.tid),
            case_title: doc.title || h.title,
            court: doc.docsource || h.docsource,
            decision_date: doc.publishdate || h.publishdate,
            citation: doc.citation,
            text: plain.slice(0, IK_BODY_KEEP_CHARS),
            url: ikUrl(h.tid)
          });
        }
      } catch {
        /* keep snippet only */
      }
    }
  }
  return chunks;
}
