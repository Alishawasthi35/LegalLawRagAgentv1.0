import { NextResponse } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Magic-link callback. Exchanges the OAuth code for a session, sets the
 * auth cookies on the redirect response, then sends the user to `next`
 * (defaults to /app).
 *
 * Cookie-binding nuance: we build the response object FIRST and bind
 * the Supabase client's cookie setters to it. That way, when
 * exchangeCodeForSession writes the session cookies, they land on the
 * outgoing redirect — not on the orphan request object. This was the
 * cause of the "magic link silently redirects to homepage" bug.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const errorDesc = url.searchParams.get("error_description");
  const next = url.searchParams.get("next") ?? "/app";

  // If Supabase appended an error (e.g. otp_expired), bounce to /login
  // with the error attached so the login page can surface it.
  if (errorDesc) {
    const redirect = new URL("/login", url.origin);
    redirect.hash = `error_description=${encodeURIComponent(errorDesc)}`;
    return NextResponse.redirect(redirect);
  }

  if (!code) {
    return NextResponse.redirect(new URL("/login", url.origin));
  }

  // Build the redirect response upfront so cookie setters can attach to it.
  const response = NextResponse.redirect(new URL(next, url.origin));

  const cookieStore = cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get: (name: string) => cookieStore.get(name)?.value,
        set: (name: string, value: string, options: CookieOptions) => {
          response.cookies.set({ name, value, ...options });
        },
        remove: (name: string, options: CookieOptions) => {
          response.cookies.set({ name, value: "", ...options });
        }
      }
    }
  );

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    const redirect = new URL("/login", url.origin);
    redirect.hash = `error_description=${encodeURIComponent(error.message)}`;
    return NextResponse.redirect(redirect);
  }

  return response;
}
