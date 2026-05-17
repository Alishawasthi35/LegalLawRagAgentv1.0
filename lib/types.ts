// Shared types used across agent + UI + API.

export type Confidence = "high" | "medium" | "low";

export interface CaseRef {
  case_id?: string;
  ik_doc_id?: string;
  case: string;             // human-readable case name
  citation?: string;
  court?: string;
  bench?: string;
  date?: string;            // ISO
  url?: string;
}

export interface AuthorityClaim extends CaseRef {
  holding: string;
  verbatim_quote: string;   // MUST exist in retrieved context, validated by verifier
  key_paragraphs?: number[];
  relevance_note?: string;  // why this authority applies to the present query
  confidence: Confidence;
  verified: boolean;        // set by verifier after substring check
}

export interface StatuteRef {
  source: string;           // e.g. "CrPC §438"
  act?: string;
  section?: string;
  text_verbatim: string;
  url?: string;
  in_force?: boolean;
}

export interface RecentDevelopment {
  title: string;
  date?: string;
  source: "judgment" | "amendment" | "circular" | "news";
  summary: string;
  url?: string;
  case_ref?: CaseRef;
}

export interface FrameworkPoint {
  title: string;          // short headline of the principle / element / factor
  detail: string;         // 1-3 sentence expansion
  authority?: string;     // optional case or section reference
}

export interface StructuredAnswer {
  headline: string;
  issue: string;
  query_type:
    | "doctrinal_summary"
    | "case_lookup"
    | "section_lookup"
    | "factual_application"
    | "comparison"
    | "other";
  applicable_law: StatuteRef[];
  doctrinal_framework?: FrameworkPoint[];  // elements / tests / factors — always populated when relevant
  leading_authorities: AuthorityClaim[];
  subsequent_application?: AuthorityClaim[];
  divergence_or_doubts?: AuthorityClaim[];
  recent_developments?: RecentDevelopment[];
  analysis: string;
  practical_guidance?: string[];           // bullet-list takeaways for a judge to apply
  unresolved_questions?: string[];
  caveats: string[];
  meta: {
    model: string;
    retrieved_chunks: number;
    sources_used: string[];
    elapsed_ms?: number;
    warning?: string;       // e.g. "Verifier flagged 1 claim"
  };
}

// -------- Agent internals --------

export interface AgentPlan {
  query_type: StructuredAnswer["query_type"];
  statutes: string[];               // bare-act lookups, e.g. "CrPC §438"
  anchor_cases: string[];           // explicit cases mentioned
  sub_questions: string[];          // 1–5 retrieval-ready questions
  recency_window_days?: number;
  needs_constitution_bench_check?: boolean;
  jurisdictions?: string[];         // optional court filter
}

export interface RetrievedChunk {
  chunk_id: string;
  source: "pgvector" | "indiankanoon" | "statute" | "sci_recent" | "web";
  case_id?: string;
  ik_doc_id?: string;
  case_title?: string;
  citation?: string;
  court?: string;
  decision_date?: string;
  para_number?: number;
  text: string;
  similarity?: number;
  url?: string;
  rerank_score?: number;
}

export interface AgentTrace {
  plan: AgentPlan;
  retrieved: RetrievedChunk[];
  reranked: RetrievedChunk[];
  elapsed: { plan_ms: number; retrieve_ms: number; rerank_ms: number; synth_ms: number; verify_ms: number };
}
