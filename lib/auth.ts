/**
 * Auth helpers — single source of truth for "is auth required" and
 * "who is the current user".
 *
 * Set NEXT_PUBLIC_DISABLE_AUTH=true to bypass auth entirely (guest mode).
 * In guest mode every request is treated as the GUEST user and all DB
 * operations go through the service-role client (bypassing RLS).
 *
 * To re-enable auth later, set NEXT_PUBLIC_DISABLE_AUTH=false (or unset it)
 * and redeploy. No other code changes needed.
 */

import type { SupabaseClient, User } from "@supabase/supabase-js";
import { createClient as createServerSupabase } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

export const AUTH_DISABLED = process.env.NEXT_PUBLIC_DISABLE_AUTH === "true";

// Stable UUID used as the guest user id in auth-disabled mode.
// Note: this row is also seeded into auth.users by the migration so FK
// constraints on user_id are satisfied.
export const GUEST_USER_ID = "11111111-1111-4111-8111-111111111111";
export const GUEST_EMAIL = "guest@nyaya.local";

export interface SessionUser {
  id: string;
  email: string;
  is_guest: boolean;
}

/**
 * Get the current user. In auth-disabled mode, always returns the guest user.
 * Otherwise, reads the real Supabase auth session.
 *
 * Returns `null` only when auth IS enabled AND no user is signed in.
 */
export async function getCurrentUser(): Promise<SessionUser | null> {
  if (AUTH_DISABLED) {
    return { id: GUEST_USER_ID, email: GUEST_EMAIL, is_guest: true };
  }
  const sb = createServerSupabase();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;
  return { id: user.id, email: user.email ?? "", is_guest: false };
}

/**
 * Get the right Supabase client for DB ops based on auth mode.
 *
 * - Auth enabled  → user-scoped client (respects RLS, uses session cookies)
 * - Auth disabled → service-role client (bypasses RLS; safe because the
 *   whole project is gated by guest mode)
 */
export function getDbClient(): SupabaseClient {
  if (AUTH_DISABLED) return createServiceClient();
  return createServerSupabase();
}
