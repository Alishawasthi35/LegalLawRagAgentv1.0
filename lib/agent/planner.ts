import { geminiText } from "@/lib/gemini";
import { extractJson } from "@/lib/utils";
import type { AgentPlan } from "@/lib/types";
import { PLANNER_SYSTEM, plannerUserPrompt } from "./prompts";

export async function plan(query: string, history?: string): Promise<AgentPlan> {
  const raw = await geminiText(plannerUserPrompt(query, history), {
    systemInstruction: PLANNER_SYSTEM,
    temperature: 0.1,
    maxOutputTokens: 1024,
    json: true
  });

  try {
    const parsed = extractJson<AgentPlan>(raw);
    return normalise(parsed, query);
  } catch {
    // Fallback: degrade to a single sub-question = the user query verbatim.
    return {
      query_type: "other",
      statutes: [],
      anchor_cases: [],
      sub_questions: [query],
      recency_window_days: 0,
      needs_constitution_bench_check: false,
      jurisdictions: []
    };
  }
}

function normalise(p: Partial<AgentPlan>, query: string): AgentPlan {
  return {
    query_type: p.query_type ?? "other",
    statutes: Array.isArray(p.statutes) ? p.statutes.slice(0, 8) : [],
    anchor_cases: Array.isArray(p.anchor_cases) ? p.anchor_cases.slice(0, 6) : [],
    sub_questions:
      Array.isArray(p.sub_questions) && p.sub_questions.length > 0
        ? p.sub_questions.slice(0, 5)
        : [query],
    recency_window_days: typeof p.recency_window_days === "number" ? p.recency_window_days : 0,
    needs_constitution_bench_check: Boolean(p.needs_constitution_bench_check),
    jurisdictions: Array.isArray(p.jurisdictions) ? p.jurisdictions : []
  };
}
