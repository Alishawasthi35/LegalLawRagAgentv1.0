# Nyaya — Indian Legal Research Agent

> An agentic RAG system over Indian case law, statutes, and tribunal orders. Built for judges.
>
> **Hard rule:** this tool is a research aid only. Every output must be verified against the original judgment before relying on it.

The project, the architecture, and the design trade-offs are described in detail in [PLAN.md](./PLAN.md). Read that first.

---

## What it does

Given a query like *"Summarise the law on anticipatory bail under §438 CrPC after Sushila Aggarwal"*, Nyaya:

1. **Plans** — Gemini decomposes the query into 3–5 retrieval-ready sub-questions, plus the statutes and anchor cases to look up.
2. **Retrieves in parallel** from four sources: (a) Supabase pgvector corpus, (b) IndianKanoon API, (c) bare-acts table, (d) recent SCI/HC index.
3. **Reranks** the 60–120 candidate chunks down to the top 12 using an LLM-as-judge.
4. **Synthesises** a structured JSON analysis with headline, issue, applicable law, leading authorities, subsequent application, divergence, recent developments, analysis, unresolved questions, caveats.
5. **Verifies** every `verbatim_quote` programmatically against the retrieved context. Unverified claims are removed and flagged.

The UI renders the result as structured cards with verbatim quotes in a serif font and a one-click "Open on IndianKanoon" button beside every authority.

---

## Stack

| Layer | Technology | Free tier |
|---|---|---|
| Frontend / hosting | Next.js 14 (App Router) + Vercel | Yes (Hobby) |
| LLM | Google Gemini 2.5 Flash | 500 RPD |
| Fallback LLM | Groq Llama 3.3 70B | 14,400 RPD |
| Embeddings | Google text-embedding-004 (768-dim) | Yes |
| Database | Supabase Postgres + pgvector | 500 MB |
| Auth | Supabase magic-link | 50k MAU |
| Case data | IndianKanoon API | ₹10k/month non-commercial credit |
| Cron | Vercel Cron | 2 jobs |

Cost to run for a single user with normal research load: **₹0**.

---

## One-time setup

### 1. Create accounts (all free)

- **Supabase** — https://supabase.com → new project. Note the project URL, anon key, and service role key.
- **Google AI Studio** — https://aistudio.google.com/apikey → create a free API key.
- **Groq** — https://console.groq.com/keys → create a key.
- **IndianKanoon API** — https://api.indiankanoon.org/signup/ → sign up, then **apply for the non-commercial / academic credit** in your dashboard (judicial research qualifies; the credit is ₹10,000/month, refreshed monthly).
- **Vercel** — https://vercel.com (link GitHub for auto-deploy).

### 2. Apply the database migration

In your Supabase project's SQL editor, paste the contents of `supabase/migrations/0001_init.sql` and run it. This creates:

- `cases`, `case_chunks` (with `vector(768)` + HNSW index), `statutes`
- `chat_sessions`, `messages`, `bookmarks`, `citations`, `api_usage`, `ingestion_jobs`
- Two RPC functions: `match_case_chunks` and `match_statutes`
- Row-level security policies on every user-scoped table
- Triggers for `updated_at` and session-bump-on-message

### 3. Local environment

```bash
git clone <this-repo>
cd nyaya-legal-research
cp .env.example .env.local
# Fill in every value in .env.local
npm install
```

### 4. Seed the corpus (run once)

```bash
npm run seed:bare-acts     # ~10 sections; ~30 sec
npm run seed:corpus        # ~10 landmark judgments; ~5 min
```

You can grow the landmark list at any time by editing `scripts/landmark-cases.json` and re-running. Cases already ingested are skipped.

### 5. Run locally

```bash
npm run dev
# open http://localhost:3000
```

Sign in with your email — Supabase sends a magic link. Click through and you're in the workspace.

---

## Deploying to Vercel

1. Push the repo to GitHub.
2. In Vercel: **Add New… → Project → Import** the repo.
3. Under Environment Variables, paste in every key from `.env.local` (don't include `NEXT_PUBLIC_APP_URL` — Vercel will set it; you should add it pointing at your deployed URL).
4. Deploy. Vercel reads `vercel.json` and registers the nightly cron at 03:00 IST.
5. In Supabase → Authentication → URL Configuration, add your Vercel URL to **Site URL** and **Redirect URLs**:
   - `https://<your-vercel-url>` (site)
   - `https://<your-vercel-url>/auth/callback` (redirect)

Done. Magic link emails will redirect through your live URL after deployment.

---

## Project layout

```
app/                        Next.js app router pages + API routes
  api/chat/                 SSE-streamed agent endpoint
  api/sessions/             list + delete sessions
  api/bookmarks/            CRUD bookmarks
  api/ingest/               on-demand ingestion (cron-secret protected)
  api/cron/refresh/         nightly SCI top-up (Vercel cron)
  auth/callback/            Supabase magic-link landing
  login/                    sign-in page
  app/                      protected workspace
  bookmarks/                saved authorities
components/
  chat/                     ChatWindow, Composer, StructuredAnswer, AuthorityCard, StageIndicator
  sidebar/                  SessionSidebar
  ui/                       shadcn-style primitives (Button, Card, Badge, etc.)
lib/
  gemini.ts                 Gemini text + embedding client
  groq.ts                   Groq fallback
  indiankanoon.ts           IK API client
  supabase/{client,server,service}.ts
  agent/
    planner.ts              query → AgentPlan
    retriever.ts            hybrid retrieval (pgvector + IK + statutes)
    reranker.ts             LLM-as-judge reranking, top 12
    synthesizer.ts          structured JSON synthesis
    verifier.ts             programmatic citation verification
    index.ts                orchestrator (generator yielding stage events)
    prompts.ts              all LLM prompts
  chunking.ts               paragraph-aware judgment chunker
  types.ts                  shared TS types
  utils.ts                  cn, formatDate, extractJson, quoteIsGrounded
supabase/migrations/0001_init.sql
scripts/
  seed-bare-acts.ts
  seed-corpus.ts
  bare-acts-seed.json
  landmark-cases.json
vercel.json                 cron + function maxDuration
middleware.ts               Supabase auth refresh + /app gating
```

---

## Safety architecture (recap from PLAN.md §8)

1. **Grounded generation** — synthesizer prompt forbids unsourced claims.
2. **Verbatim quote requirement** — every authority must include a quote. Programmatic substring check after generation (`lib/utils.ts → quoteIsGrounded`).
3. **Citation deep-link** — every claim links to `indiankanoon.org/doc/{id}`.
4. **Confidence scoring** — high / medium / low, surfaced visually in the AuthorityCard.
5. **Recency check** — recency window passed into IK search filter when relevant.
6. **Persistent disclaimer** — non-dismissable caveat in every response.
7. **Audit trail** — every assistant message stores `retrieved_context` (compressed) for after-the-fact verification.

---

## Limits and how to push past them

- **Gemini 500 RPD** — the binding constraint. The agent uses 3–4 Gemini calls per query (planner, reranker, synthesizer, optionally verifier). That gives ~125 deep queries/day. If you exhaust it, Groq automatically takes over. To raise the ceiling permanently, switch the project to Gemini's paid tier (still cheap — ~$0.075 / 1M input tokens for Flash).
- **Supabase 500 MB** — limits the embedded corpus. The seed includes ~10 landmark cases; the design supports growing to ~20–30k cases before you'd outgrow free tier. Add to `scripts/landmark-cases.json` to grow.
- **Vercel cron** — limited to 2 jobs on Hobby. We use 1.

---

## License & disclaimer

This is open-source infrastructure intended as a research aid for the bench. The accuracy of any output is the responsibility of the user. Always read the original judgment.
