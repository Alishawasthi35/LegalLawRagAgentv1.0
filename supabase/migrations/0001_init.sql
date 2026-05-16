-- =============================================================
--  Nyaya — initial schema
--  Apply in Supabase SQL editor on a fresh project.
-- =============================================================

create extension if not exists "vector";
create extension if not exists "pg_trgm";
create extension if not exists "pgcrypto";

-- -------------------------------------------------------------
-- 1. CASES & STATUTES (corpus — world-readable)
-- -------------------------------------------------------------
create table if not exists public.cases (
  id              uuid primary key default gen_random_uuid(),
  ik_doc_id       text unique,                         -- IndianKanoon docId
  title           text not null,
  court           text,                                -- e.g. "Supreme Court of India"
  bench           text,                                -- e.g. "5-judge Constitution Bench"
  judges          text[],
  decision_date   date,
  citation        text,                                -- e.g. "(2020) 5 SCC 1"
  url             text,
  headnote        text,
  full_text       text,                                -- only stored for short cases
  metadata        jsonb default '{}'::jsonb,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);
create index if not exists cases_court_date_idx on public.cases (court, decision_date desc);
create index if not exists cases_title_trgm_idx on public.cases using gin (title gin_trgm_ops);
create index if not exists cases_ik_doc_idx on public.cases (ik_doc_id);

create table if not exists public.case_chunks (
  id            uuid primary key default gen_random_uuid(),
  case_id       uuid not null references public.cases(id) on delete cascade,
  chunk_text    text not null,
  para_number   int,                                   -- judgment paragraph number when known
  token_count   int,
  embedding     vector(768),                           -- text-embedding-004 dimensions
  created_at    timestamptz default now()
);
-- HNSW index for fast cosine-similarity ANN search.
create index if not exists case_chunks_embedding_idx
  on public.case_chunks using hnsw (embedding vector_cosine_ops);
create index if not exists case_chunks_case_idx on public.case_chunks (case_id);

create table if not exists public.statutes (
  id            uuid primary key default gen_random_uuid(),
  act           text not null,                         -- e.g. "Code of Criminal Procedure, 1973"
  act_short     text,                                  -- e.g. "CrPC"
  section       text not null,                         -- "438", "138", etc.
  subsection    text,
  heading       text,
  text          text not null,
  chapter       text,
  in_force      boolean default true,                  -- false for repealed (IPC, CrPC post-BNSS)
  successor_id  uuid references public.statutes(id),   -- BNS/BNSS link to predecessor IPC/CrPC
  embedding     vector(768),
  metadata      jsonb default '{}'::jsonb,
  created_at    timestamptz default now()
);
create unique index if not exists statutes_act_section_idx
  on public.statutes (act_short, section, coalesce(subsection, ''));
create index if not exists statutes_text_trgm on public.statutes using gin (text gin_trgm_ops);
create index if not exists statutes_embedding_idx
  on public.statutes using hnsw (embedding vector_cosine_ops);

-- -------------------------------------------------------------
-- 2. USER WORKSPACE (auth-scoped — RLS)
-- -------------------------------------------------------------
create table if not exists public.chat_sessions (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  title        text not null default 'Untitled research',
  pinned       boolean default false,
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);
create index if not exists chat_sessions_user_idx on public.chat_sessions (user_id, updated_at desc);

create table if not exists public.messages (
  id           uuid primary key default gen_random_uuid(),
  session_id   uuid not null references public.chat_sessions(id) on delete cascade,
  user_id      uuid not null references auth.users(id) on delete cascade,
  role         text not null check (role in ('user', 'assistant', 'system')),
  content_text text,                                   -- for user messages
  content_json jsonb,                                  -- structured assistant output
  retrieved_context jsonb,                             -- audit trail: what model saw
  tokens_used  int,
  model        text,
  created_at   timestamptz default now()
);
create index if not exists messages_session_idx on public.messages (session_id, created_at);

create table if not exists public.bookmarks (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  case_id      uuid references public.cases(id) on delete cascade,
  statute_id   uuid references public.statutes(id) on delete cascade,
  note         text,
  tags         text[] default '{}',
  created_at   timestamptz default now(),
  check (case_id is not null or statute_id is not null)
);
create index if not exists bookmarks_user_idx on public.bookmarks (user_id, created_at desc);

create table if not exists public.citations (
  id           uuid primary key default gen_random_uuid(),
  message_id   uuid not null references public.messages(id) on delete cascade,
  user_id      uuid not null references auth.users(id) on delete cascade,
  case_id      uuid references public.cases(id),
  statute_id   uuid references public.statutes(id),
  rank         int,
  confidence   text check (confidence in ('high', 'medium', 'low')),
  created_at   timestamptz default now()
);
create index if not exists citations_user_idx on public.citations (user_id);
create index if not exists citations_message_idx on public.citations (message_id);

create table if not exists public.api_usage (
  id           bigserial primary key,
  user_id      uuid references auth.users(id) on delete set null,
  provider     text not null,                          -- 'gemini' | 'groq' | 'indiankanoon'
  endpoint     text,
  tokens_in    int,
  tokens_out   int,
  cost_estimate numeric(10, 6),
  status       text default 'ok',
  created_at   timestamptz default now()
);
create index if not exists api_usage_provider_day_idx on public.api_usage (provider, created_at desc);

create table if not exists public.ingestion_jobs (
  id           uuid primary key default gen_random_uuid(),
  ik_doc_id    text unique,
  status       text not null default 'pending' check (status in ('pending','running','done','failed')),
  attempts     int default 0,
  error        text,
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);

-- -------------------------------------------------------------
-- 3. RPC: vector search functions
-- -------------------------------------------------------------
create or replace function public.match_case_chunks(
  query_embedding vector(768),
  match_count int default 12,
  similarity_threshold float default 0.5,
  court_filter text default null,
  min_date date default null
)
returns table (
  chunk_id      uuid,
  case_id       uuid,
  chunk_text    text,
  para_number   int,
  similarity    float,
  case_title    text,
  citation      text,
  court         text,
  decision_date date,
  url           text
)
language sql stable as $$
  select
    cc.id as chunk_id,
    cc.case_id,
    cc.chunk_text,
    cc.para_number,
    1 - (cc.embedding <=> query_embedding) as similarity,
    c.title as case_title,
    c.citation,
    c.court,
    c.decision_date,
    c.url
  from public.case_chunks cc
  join public.cases c on c.id = cc.case_id
  where (1 - (cc.embedding <=> query_embedding)) >= similarity_threshold
    and (court_filter is null or c.court = court_filter)
    and (min_date is null or c.decision_date >= min_date)
  order by cc.embedding <=> query_embedding
  limit match_count;
$$;

create or replace function public.match_statutes(
  query_embedding vector(768),
  match_count int default 6,
  similarity_threshold float default 0.5,
  in_force_only boolean default true
)
returns table (
  statute_id   uuid,
  act          text,
  act_short    text,
  section      text,
  subsection   text,
  heading      text,
  text         text,
  similarity   float
)
language sql stable as $$
  select
    s.id,
    s.act,
    s.act_short,
    s.section,
    s.subsection,
    s.heading,
    s.text,
    1 - (s.embedding <=> query_embedding) as similarity
  from public.statutes s
  where (1 - (s.embedding <=> query_embedding)) >= similarity_threshold
    and (not in_force_only or s.in_force = true)
  order by s.embedding <=> query_embedding
  limit match_count;
$$;

-- -------------------------------------------------------------
-- 4. ROW-LEVEL SECURITY
-- -------------------------------------------------------------
alter table public.cases       enable row level security;
alter table public.case_chunks enable row level security;
alter table public.statutes    enable row level security;
alter table public.chat_sessions enable row level security;
alter table public.messages    enable row level security;
alter table public.bookmarks   enable row level security;
alter table public.citations   enable row level security;
alter table public.api_usage   enable row level security;
alter table public.ingestion_jobs enable row level security;

-- Corpus is public: anyone (incl. anon) can read; only service-role writes.
create policy "corpus_read_cases"   on public.cases       for select using (true);
create policy "corpus_read_chunks"  on public.case_chunks for select using (true);
create policy "corpus_read_statutes" on public.statutes   for select using (true);

-- User workspace is private to the owner.
create policy "own_sessions"     on public.chat_sessions for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own_messages"     on public.messages      for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own_bookmarks"    on public.bookmarks     for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own_citations"    on public.citations     for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own_api_usage"    on public.api_usage     for select using (auth.uid() = user_id);

-- ingestion_jobs is service-role only — no policy means no anon/auth access.

-- -------------------------------------------------------------
-- 5. TRIGGERS
-- -------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists trg_cases_touch on public.cases;
create trigger trg_cases_touch before update on public.cases
  for each row execute function public.touch_updated_at();

drop trigger if exists trg_sessions_touch on public.chat_sessions;
create trigger trg_sessions_touch before update on public.chat_sessions
  for each row execute function public.touch_updated_at();

-- When a new message lands, bump its session's updated_at.
create or replace function public.bump_session_on_message()
returns trigger language plpgsql as $$
begin
  update public.chat_sessions set updated_at = now() where id = new.session_id;
  return new;
end $$;

drop trigger if exists trg_messages_bump_session on public.messages;
create trigger trg_messages_bump_session after insert on public.messages
  for each row execute function public.bump_session_on_message();
