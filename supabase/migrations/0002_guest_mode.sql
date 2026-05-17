-- =============================================================
--  Guest mode support — run ONCE in Supabase SQL Editor.
--
--  Removes the FK constraints from user-scoped tables so that a
--  hardcoded guest UUID (used when NEXT_PUBLIC_DISABLE_AUTH=true)
--  can write rows without a matching auth.users entry.
--
--  RLS policies are unaffected — in normal auth mode they continue
--  to scope reads/writes to the signed-in user. In guest mode the
--  service-role client bypasses RLS, so security is gated by the
--  env flag and Vercel's env-var protection.
-- =============================================================

alter table public.chat_sessions drop constraint if exists chat_sessions_user_id_fkey;
alter table public.messages      drop constraint if exists messages_user_id_fkey;
alter table public.bookmarks     drop constraint if exists bookmarks_user_id_fkey;
alter table public.citations     drop constraint if exists citations_user_id_fkey;
alter table public.api_usage     drop constraint if exists api_usage_user_id_fkey;
