# Indian Legal Research Agent — Architecture & Implementation Plan

**Project**: Nyaya — an agentic legal research assistant for Indian judges, built on RAG over Indian case law, statutes, and tribunal orders.
**Target user**: Sitting judge (you) using it as a research aid before delivering judgments.
**Non-negotiable constraints**: Highly accurate, fully free-tier (model + hosting + DB), Vercel deployment, professional UI, full citation grounding.

---

## 1. Why agentic RAG, not a plain LLM call

A plain LLM call against Gemini will hallucinate case names, paragraph numbers, and even statute sections. This has happened in real US filings (the *Mata v. Avianca* fiasco) and Indian high courts have already issued warnings against AI-generated fake citations. For judicial use, this is unacceptable.

A "simple RAG" pipeline (embed query → vector search → stuff into prompt) is also insufficient for legal work because:

1. **A single question fans out into many sub-searches.** A user query like *"Is mens rea required under Section 138 NI Act when the cheque is post-dated?"* requires (a) statute lookup, (b) Supreme Court precedent on §138, (c) sub-line of cases on post-dated cheques specifically, (d) any recent overrulings or constitutional bench rulings, (e) High Court divergence.
2. **Recency is structurally critical.** A case overruled last week is worse than no case at all.
3. **The output must be structurally verifiable.** Every proposition of law must point to a paragraph in a real, retrievable judgment.

So the system is built as a **planning agent that decomposes the query, runs multi-source retrieval in parallel, reranks, then synthesizes a structured opinion with verbatim citations and a verification pass that flags any unsupported claim.**

---

## 2. High-level architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                    Next.js 14 App (Vercel)                       │
│  ┌─────────────────┐  ┌─────────────────┐  ┌────────────────┐    │
│  │ Landing / Auth  │  │  Chat UI (SSE)  │  │  Bookmarks/Hx  │    │
│  └─────────────────┘  └────────┬────────┘  └────────────────┘    │
└─────────────────────────────────┼───────────────────────────────-┘
                                  │  POST /api/chat (stream)
                                  ▼
┌──────────────────────────────────────────────────────────────────┐
│              Edge / Serverless Function: Agent loop              │
│                                                                  │
│   ┌──────────┐   ┌──────────────┐   ┌───────────┐   ┌─────────┐  │
│   │ Planner  ├──►│  Retriever   ├──►│ Reranker  ├──►│Synth.+  │  │
│   │ (LLM)    │   │ (4 sources)  │   │ (LLM/BGE) │   │Verifier │  │
│   └──────────┘   └──────┬───────┘   └───────────┘   └────┬────┘  │
│                         │                                │       │
│                         ▼                                ▼       │
│                ┌───────────────────┐          ┌─────────────────┐│
│                │ Pgvector (Supabase)          │ Verbatim grounded││
│                │ IndianKanoon API             │ structured JSON  ││
│                │ SCI / eCourts scrape         │ → streamed to UI ││
│                │ Bare Acts (offline corpus)   │                  ││
│                └───────────────────┘          └─────────────────┘│
└──────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌──────────────────────────────────────────────────────────────────┐
│                  Supabase (Postgres + pgvector)                  │
│   • auth.users  • cases  • case_chunks (vector)                  │
│   • chat_sessions  • messages  • citations  • bookmarks          │
│   • ingestion_jobs  • api_usage  • RLS on everything             │
└──────────────────────────────────────────────────────────────────┘
```

---

## 3. The agent loop — step by step

When you ask *"summarise the law on anticipatory bail under §438 CrPC after Sushila Aggarwal"*, the system runs this loop:

**Step 1 — Plan (Gemini, ~200 tokens output).** A small LLM call decomposes the query into a structured plan:
```json
{
  "query_type": "doctrinal_summary",
  "statutes": ["CrPC §438", "BNSS §482"],
  "anchor_cases": ["Sushila Aggarwal v. State (NCT of Delhi), (2020) 5 SCC 1"],
  "sub_questions": [
    "What did Sushila Aggarwal hold on duration of anticipatory bail?",
    "What was the law before Sushila Aggarwal (Salauddin, Siddharam Mhetre)?",
    "Post-2020 SC and HC application of Sushila Aggarwal",
    "Has BNSS §482 changed the position?"
  ],
  "recency_window_days": 365,
  "needs_constitution_bench_check": true
}
```

**Step 2 — Retrieve (parallel, 4 sources).**

| Source | What it gives us | How |
|---|---|---|
| Supabase pgvector (`case_chunks`) | Pre-indexed semantic neighbours | `match_chunks()` SQL function, cosine sim, top-k=20 per sub-question |
| IndianKanoon API `/search/` | Authoritative live coverage of all Indian courts + tribunals | Use one search per sub-question; fetch `/doc/{id}` only for top hits |
| Bare-act lookup table | Statute text (BNS, BNSS, BSA, IPC, CrPC, Evidence, Constitution) | Stored once in Supabase, retrieved by section number |
| Recency feed | Last 30 days from SCI + major HCs | Daily cron-scraped index (see §7) |

The retriever runs all four in parallel inside one serverless invocation. Aggregate raw candidates: typically 60–120 chunks.

**Step 3 — Rerank (LLM-as-reranker).** Gemini 2.5 Flash scores each candidate 0–1 on `(relevance, authority, recency)`. We drop everything below 0.4 and keep top 12. This is cheap (one batched call ≈ 1500 input tokens) and dramatically reduces hallucination because the synthesizer only sees high-quality context.

**Step 4 — Synthesize.** Gemini produces structured JSON, never free-form prose:
```json
{
  "headline": "...",
  "issue": "...",
  "applicable_law": [{"source": "CrPC §438", "text_verbatim": "...", "url": "..."}],
  "leading_authorities": [
    {
      "case": "Sushila Aggarwal v. State (NCT of Delhi)",
      "citation": "(2020) 5 SCC 1",
      "bench": "5-judge Constitution Bench",
      "holding": "Anticipatory bail need not be limited to a fixed period...",
      "key_paragraphs": [92, 93],
      "verbatim_quote": "...",
      "url": "https://indiankanoon.org/doc/..."
    }
  ],
  "subsequent_application": [...],
  "divergence_or_doubts": [...],
  "recent_developments": [...],
  "analysis": "...",
  "caveats": ["This summary is a research aid; verify all citations before relying."]
}
```
The UI renders this structurally — no walls of text.

**Step 5 — Verify (the safety net).** A final Gemini pass takes the synthesised output + the retrieved context and checks every `verbatim_quote` and `holding` against the source chunks. Any claim that cannot be matched is **flagged in the UI as unverified**. This catches the residual hallucinations that grounding alone misses.

The whole loop completes in ~10–20s and uses ~4–6 Gemini calls. With 500 req/day on the free tier, that's ~80–125 queries/day per API key (more than enough for one judge; we add Groq as fallback regardless).

---

## 4. Data sources — and why we use all of them

The user asked us not to limit ourselves to IndianKanoon and CaseMine. Here are the sources we wire up:

1. **IndianKanoon API** — *Primary*. Covers SC, all HCs, most tribunals, statutes. Non-commercial use gets **₹10,000/month free credit** (judicial research qualifies). API: `/search/`, `/doc/{docid}`, `/docfragment/`, `/docmeta/`. We call `/search/` per sub-question and `/doc/` only on confirmed hits — cost per query ≈ ₹0.50–1.00, well within free credit.
2. **Supreme Court of India website** (`main.sci.gov.in`) — Free, scrape-able judgment index. We scrape daily for the previous day's reportable judgments to capture *fresh* law that hasn't propagated to IK yet.
3. **eCourts Services** (`services.ecourts.gov.in`) — Public free portal for HC/district orders. We use this for case status and recent orders not yet on IK.
4. **Bare Acts** — We ship a curated, deduplicated corpus of the major statutes (BNS 2023, BNSS 2023, BSA 2023, IPC 1860, CrPC 1973, IEA 1872, Constitution, NI Act, CPC, Companies Act, IT Act, Arbitration Act, Family laws) as JSON. Stored once in Supabase, ~5MB. Lookup is O(1) by section.
5. **CaseMine** — No official free API; we don't depend on it. The user can still cross-check there.
6. **PRS Legislative Research** (prsindia.org) — for legislative intent / Bill summaries when a recent amendment is in play. We fetch on-demand.
7. **NJDG** (National Judicial Data Grid) — useful metadata, but mostly statistical; we don't index it for retrieval.

The architectural rule: **IndianKanoon is the trunk; everything else is a graft for cases IK doesn't cover or is slow to update.**

---

## 5. Free-tier stack — final picks

| Layer | Choice | Free tier | Why |
|---|---|---|---|
| Frontend | Next.js 14 + Tailwind + shadcn/ui | — | Vercel-native |
| Hosting | Vercel | Hobby plan: 100GB bandwidth, unlimited static, serverless functions | Standard |
| LLM (reasoning) | Gemini 2.5 Flash | 10 RPM, 500 RPD, 250k TPM | 1M context, strong at long-document QA |
| LLM (fallback) | Groq `llama-3.3-70b-versatile` | 30 RPM, 14400 RPD | When Gemini quota hits or for low-latency reranking |
| Embeddings | Gemini `text-embedding-004` | 1500 RPM (separate quota) | 768-dim, multilingual, free |
| Database | Supabase (Postgres 15 + pgvector) | 500MB DB, 50k MAU auth, 5GB egress | Auth + vectors + relational in one |
| Auth | Supabase Auth (email magic-link) | included | No password handling burden |
| Background jobs | Vercel Cron | 2 cron jobs free | For nightly SCI scrape |
| Observability | Vercel logs + Supabase logs | included | Adequate |
| Source code | GitHub | free | Standard |

Total monthly cost: **₹0**, assuming you stay within Gemini's 500 RPD (with Groq as overflow this is realistic for one user).

---

## 6. Database schema (Supabase / Postgres)

Full SQL is in `supabase/migrations/0001_init.sql`. Highlights:

- `cases` — one row per judgment. Columns: `id`, `ik_doc_id`, `title`, `court`, `bench`, `judges`, `date`, `citation`, `url`, `summary`, `full_text` (for short cases), `metadata` JSONB, `created_at`. Indexed on `(court, date)` and trigram on `title`.
- `case_chunks` — chunked paragraphs with `embedding vector(768)`, `chunk_text`, `para_number`, `case_id`. HNSW index on the vector column for fast ANN.
- `statutes` — bare-act sections: `act`, `section`, `subsection`, `text`, `chapter`. Trigram + full-text index.
- `chat_sessions` — `id`, `user_id`, `title`, `created_at`, `updated_at`.
- `messages` — `id`, `session_id`, `role`, `content_json` (the structured output), `created_at`. `content_json` lets us re-render the rich UI exactly.
- `citations` — many-to-many between messages and cases/statutes — used to power "view all cases I've researched" and to build a personal citation index.
- `bookmarks` — `user_id`, `case_id`, `note`, `tags[]`.
- `api_usage` — log of provider calls for budget tracking (date, provider, tokens, cost_estimate).
- `ingestion_jobs` — tracks IK doc fetches so we don't double-ingest.

**RLS**: every user-scoped table has RLS policies `user_id = auth.uid()`. `cases`/`case_chunks`/`statutes` are world-readable (the corpus is public domain).

The 500MB budget breaks down approximately as: bare acts ~5MB, top-20k Supreme Court cases chunked & embedded ~250MB, chat history + auth ~50MB, buffer ~195MB. We progressively grow the corpus from the most cited cases outward.

---

## 7. Ingestion & freshness

We use **lazy on-demand ingestion + scheduled top-up**:

- **On-demand**: when the agent retrieves a case from IK that isn't in our pgvector index, we chunk + embed + insert it in the background (fire-and-forget). Next time it's a hot hit.
- **Scheduled**: a Vercel cron at 03:00 IST hits the SCI daily order list, ingests reportable judgments from the previous day. Same cron also re-embeds any case whose IK record was updated.
- **Seed corpus**: a one-time script (`scripts/seed-corpus.ts`) ingests the ~2000 most-cited landmark Indian judgments + the major bare acts. Run once after setup. Takes ~30 minutes.

---

## 8. The safety / verification layer (per your "maximum" choice)

This is the most important section for a judge. We treat hallucination as the primary failure mode and engineer against it at every layer:

1. **Grounded generation only.** The synthesizer prompt forbids producing a `holding` or `verbatim_quote` not present in the retrieved context. We pass the context with `[chunk_id]` markers and require the model to cite `[chunk_id]` after every claim.
2. **Verbatim quote requirement.** Every authority must include a `verbatim_quote` that is character-for-character present in the source chunk. We programmatically verify this with substring matching in `verifier.ts` — any quote that fails substring match is removed and the claim is flagged.
3. **Citation deep-link.** Every authority links to `indiankanoon.org/doc/{id}` with paragraph anchor. The UI renders a "Open source" button next to every claim.
4. **Confidence score.** Each authority gets a confidence ∈ {high, medium, low} based on: was it returned by both pgvector AND IK? did the rerank score >0.7? is it cited by ≥3 other top hits? Low-confidence items are visually de-emphasised.
5. **Recency check.** If any authority is older than 5 years and the topic has been touched by a constitution bench since, we automatically run a follow-up IK query for `"<authority name>" overruled OR doubted` and surface the result.
6. **Persistent disclaimer.** Every response carries: *"This is a research aid. The output may contain errors or omissions. Verify all citations against the original judgment before relying."* This is non-dismissable.
7. **Audit trail.** Every message stores the full retrieved context (compressed) so you can later see exactly what the model saw. Useful if you ever spot an error and want to understand why.

---

## 9. UI / UX

Professional, restrained, lawyer-appropriate. Not chatbot-cute.

- **Landing** (`/`) — masthead with the system's purpose, a single CTA "Begin Research", a sample analysis card.
- **Auth** (`/login`) — magic-link only. No passwords.
- **Workspace** (`/app`) — three-pane layout:
  - Left: collapsible session sidebar with search.
  - Center: conversation thread. Each assistant message renders the structured JSON as: Headline → Issue → Applicable Law → Leading Authorities (collapsible cards) → Recent Developments → Analysis → Caveats. Each authority card shows the verbatim quote in a serif font, with bench composition, citation, paragraph numbers, and an "Open on IndianKanoon" button.
  - Right (optional, opens on click): citation viewer — pulls the full paragraph context from IK for whichever authority you clicked.
- **Bookmarks** (`/bookmarks`) — saved cases with personal notes and tag filtering.
- **Theme** — neutral, ivory/charcoal/oxblood accents. Inter for UI, Source Serif for legal quotations.

---

## 10. What's in the repository

```
/
├── PLAN.md                          ← this file
├── README.md                        ← setup & deployment
├── package.json
├── next.config.js
├── tailwind.config.ts
├── tsconfig.json
├── .env.example
├── middleware.ts                    ← Supabase auth refresh
├── app/
│   ├── layout.tsx
│   ├── page.tsx                     ← landing
│   ├── globals.css
│   ├── login/page.tsx
│   ├── auth/callback/route.ts
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx                 ← workspace shell
│   │   └── [sessionId]/page.tsx
│   ├── bookmarks/page.tsx
│   └── api/
│       ├── chat/route.ts            ← main streaming endpoint
│       ├── sessions/route.ts
│       ├── ingest/route.ts
│       ├── bookmarks/route.ts
│       └── cron/refresh/route.ts
├── components/
│   ├── chat/
│   │   ├── ChatWindow.tsx
│   │   ├── MessageBubble.tsx
│   │   ├── StructuredAnswer.tsx
│   │   ├── AuthorityCard.tsx
│   │   ├── CitationViewer.tsx
│   │   └── Composer.tsx
│   ├── sidebar/SessionSidebar.tsx
│   ├── ui/                          ← shadcn primitives
│   └── landing/Hero.tsx
├── lib/
│   ├── supabase/
│   │   ├── client.ts                ← browser client
│   │   ├── server.ts                ← server component client
│   │   └── service.ts               ← service-role for ingestion
│   ├── gemini.ts                    ← Gemini wrapper (text + embed + safety)
│   ├── groq.ts                      ← Groq fallback
│   ├── indiankanoon.ts              ← IK API client
│   ├── scrapers/sci.ts              ← SCI daily list
│   ├── agent/
│   │   ├── index.ts                 ← orchestrator
│   │   ├── planner.ts
│   │   ├── retriever.ts
│   │   ├── reranker.ts
│   │   ├── synthesizer.ts
│   │   ├── verifier.ts
│   │   └── prompts.ts
│   ├── chunking.ts
│   ├── types.ts
│   └── utils.ts
├── supabase/
│   └── migrations/
│       └── 0001_init.sql
├── scripts/
│   ├── seed-corpus.ts               ← one-time landmark cases ingestion
│   └── seed-bare-acts.ts
└── public/
    └── (icons, fonts)
```

---

## 11. Step-by-step deployment (you'll do this once)

1. **Create accounts** (all free): Supabase, Google AI Studio, Groq, IndianKanoon API, Vercel, GitHub.
2. **Get API keys** and put them in `.env.local` (template in `.env.example`).
3. **Create Supabase project**, enable `pgvector`, run `supabase/migrations/0001_init.sql` in the SQL editor.
4. **Apply for IndianKanoon non-commercial credit** (one form, ~24h approval).
5. **Push repo to GitHub**, import to Vercel, paste env vars. Vercel auto-deploys.
6. **Run seed scripts** locally once: `npm run seed:bare-acts && npm run seed:corpus`.
7. Done. Visit your Vercel URL, log in via magic link, ask your first question.

Detailed steps with screenshots are in `README.md`.

---

## 12. Known limitations & honest tradeoffs

- **Gemini's 500 RPD ceiling** is the binding constraint. With ~5 LLM calls per query, that's ~100 deep queries/day. For one judge, this is generally fine; for a court-wide rollout you would need a paid tier.
- **500MB Supabase DB** limits the embedded corpus to roughly the top-20–30k Indian cases. Less-cited cases are served by live IK fetch (slower but accurate).
- **The verifier is itself an LLM**, so it has non-zero false-positive/negative rates. We surface this honestly in the UI (every claim is verifiable by clicking the source link).
- **Scraping the SCI site** is brittle to layout changes — the cron job logs failures to Supabase so you'll know if it breaks.
- **This is a research aid, not a replacement** for the original record. Every prompt and every output reminds the user of this.

---

## 13. Roadmap (post-MVP)

Things we deliberately don't build now but the structure supports:

- Per-judge personal corpus (upload your own briefs/orders, index privately).
- Hindi/regional language Q&A (Gemini handles this; we'd need an Indic embedding model for better recall).
- Constitution Bench timeline visualiser.
- "Brief drafting" mode (generates a draft order skeleton from your dictation + the research).
- Export to .docx for direct paste into orders.
