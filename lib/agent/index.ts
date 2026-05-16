/**
 * Orchestrator — runs the full agent loop end-to-end and produces a verified
 * StructuredAnswer along with the trace (for UI debugging + audit storage).
 *
 *   plan → retrieve → rerank → synthesize → verify
 */

import { plan as runPlanner } from "./planner";
import { retrieve } from "./retriever";
import { rerank } from "./reranker";
import { synthesize } from "./synthesizer";
import { verify } from "./verifier";
import type { AgentTrace, StructuredAnswer } from "@/lib/types";

export interface AgentResult {
  answer: StructuredAnswer;
  trace: AgentTrace;
}

export interface AgentEvent {
  type: "stage" | "result" | "error";
  stage?: "planning" | "retrieving" | "reranking" | "synthesizing" | "verifying" | "done";
  message?: string;
  data?: any;
}

export async function* runAgent(
  query: string,
  history?: string
): AsyncGenerator<AgentEvent, AgentResult, void> {
  const elapsed = { plan_ms: 0, retrieve_ms: 0, rerank_ms: 0, synth_ms: 0, verify_ms: 0 };

  yield { type: "stage", stage: "planning", message: "Decomposing the query…" };
  let t = Date.now();
  const plan = await runPlanner(query, history);
  elapsed.plan_ms = Date.now() - t;
  yield { type: "stage", stage: "planning", data: { plan, ms: elapsed.plan_ms } };

  yield {
    type: "stage",
    stage: "retrieving",
    message: `Searching ${plan.sub_questions.length} sub-question${plan.sub_questions.length === 1 ? "" : "s"} across pgvector, IndianKanoon, and statutes…`
  };
  t = Date.now();
  const retrieved = await retrieve(plan);
  elapsed.retrieve_ms = Date.now() - t;
  yield { type: "stage", stage: "retrieving", data: { count: retrieved.length, ms: elapsed.retrieve_ms } };

  yield { type: "stage", stage: "reranking", message: `Reranking ${retrieved.length} candidates…` };
  t = Date.now();
  const reranked = await rerank(query, retrieved);
  elapsed.rerank_ms = Date.now() - t;
  yield { type: "stage", stage: "reranking", data: { kept: reranked.length, ms: elapsed.rerank_ms } };

  yield { type: "stage", stage: "synthesizing", message: "Drafting the structured analysis…" };
  t = Date.now();
  let answer = await synthesize(query, reranked);
  elapsed.synth_ms = Date.now() - t;

  yield { type: "stage", stage: "verifying", message: "Verifying every claim against the source chunks…" };
  t = Date.now();
  answer = verify(answer, reranked);
  elapsed.verify_ms = Date.now() - t;

  const total = Object.values(elapsed).reduce((a, b) => a + b, 0);
  answer.meta = { ...answer.meta, elapsed_ms: total };

  const trace: AgentTrace = { plan, retrieved, reranked, elapsed };
  yield { type: "stage", stage: "done", data: { ms: total } };
  yield { type: "result", data: { answer, trace } };

  return { answer, trace };
}
