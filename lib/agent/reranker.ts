import { geminiText } from "@/lib/gemini";
import { groqText, groqAvailable } from "@/lib/groq";
import { extractJson } from "@/lib/utils";
import type { RetrievedChunk } from "@/lib/types";
import { RERANKER_SYSTEM } from "./prompts";

const TOPK = 12;
const MIN_SCORE = 0.4;

/**
 * Rerank candidate chunks via LLM-as-judge. Falls back to Groq if Gemini
 * fails, then to the original ordering by similarity if both fail.
 */
export async function rerank(query: string, candidates: RetrievedChunk[]): Promise<RetrievedChunk[]> {
  if (candidates.length <= TOPK) return tagOriginalOrder(candidates);

  const numbered = candidates
    .map(
      (c, i) =>
        `${i + 1}. [${c.case_title ?? c.source}${c.citation ? ` | ${c.citation}` : ""}${
          c.decision_date ? ` | ${c.decision_date}` : ""
        }] ${c.text.slice(0, 380)}`
    )
    .join("\n\n");

  const prompt = `User query:\n${query}\n\nCandidates:\n${numbered}\n\nReturn JSON now.`;

  let scoresRaw: string;
  try {
    scoresRaw = await geminiText(prompt, {
      systemInstruction: RERANKER_SYSTEM,
      temperature: 0,
      maxOutputTokens: 2048,
      json: true
    });
  } catch {
    if (!groqAvailable()) return tagOriginalOrder(candidates);
    try {
      scoresRaw = await groqText(prompt, { system: RERANKER_SYSTEM, temperature: 0, json: true });
    } catch {
      return tagOriginalOrder(candidates);
    }
  }

  let parsed: { scores: Array<{ id: number; score: number }> };
  try {
    parsed = extractJson(scoresRaw);
  } catch {
    return tagOriginalOrder(candidates);
  }

  const scoreById = new Map(parsed.scores.map((s) => [s.id, Number(s.score) || 0]));
  return candidates
    .map((c, i) => ({ ...c, rerank_score: scoreById.get(i + 1) ?? 0 }))
    .filter((c) => (c.rerank_score ?? 0) >= MIN_SCORE)
    .sort((a, b) => (b.rerank_score ?? 0) - (a.rerank_score ?? 0))
    .slice(0, TOPK);
}

function tagOriginalOrder(c: RetrievedChunk[]) {
  return c.slice(0, TOPK).map((x, i) => ({ ...x, rerank_score: x.similarity ?? 1 - i * 0.05 }));
}
