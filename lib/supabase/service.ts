import { createClient as createSb } from "@supabase/supabase-js";

/**
 * Service-role client — bypasses RLS.
 * Use ONLY in server-only code (API routes, scripts, cron).
 * Never import from client components.
 */
export function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Supabase service credentials missing");
  }
  return createSb(url, key, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
}
