"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Scale, Mail, Loader2, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Surface any Supabase-redirect error embedded in the URL hash fragment.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const hash = window.location.hash.replace(/^#/, "");
    if (!hash) return;
    const params = new URLSearchParams(hash);
    const errCode = params.get("error_code");
    const errDesc = params.get("error_description");
    if (errCode || errDesc) {
      const friendly =
        errCode === "otp_expired"
          ? "That magic link is no longer valid. Each new link invalidates older ones — request a fresh link below and open the most recent email."
          : (errDesc?.replace(/\+/g, " ") ?? "Sign-in error");
      setError(friendly);
      // Clear the hash so the error doesn't persist on refresh.
      history.replaceState(null, "", window.location.pathname + window.location.search);
    }
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const sb = createClient();
      // Always derive the origin from the live window — guaranteed correct.
      // The env var fallback is only for cases where this file is somehow
      // executed server-side (it shouldn't be, since it's a client component).
      const origin =
        typeof window !== "undefined" && window.location?.origin
          ? window.location.origin
          : (process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/+$/, "");
      if (!origin) {
        throw new Error("Could not determine app origin");
      }
      const redirectTo = `${origin}/auth/callback?next=/app`;
      const { error } = await sb.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: redirectTo }
      });
      if (error) throw error;
      setSent(true);
    } catch (err: any) {
      setError(err?.message ?? "Failed to send magic link");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container flex h-16 items-center">
          <Link href="/" className="flex items-center gap-2 font-serif text-xl font-semibold">
            <Scale className="h-5 w-5 text-primary" />
            <span>Nyaya</span>
          </Link>
        </div>
      </header>

      <div className="container flex min-h-[calc(100vh-4rem)] max-w-md flex-col justify-center py-12">
        <div className="rounded-xl border bg-card p-8 shadow-sm">
          <h1 className="font-serif text-2xl font-semibold">Sign in</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            We&apos;ll send you a one-time magic link. No password required.
          </p>

          {sent ? (
            <div className="mt-8 flex flex-col items-center gap-3 rounded-lg border bg-secondary/30 p-6 text-center">
              <CheckCircle2 className="h-8 w-8 text-emerald-600" />
              <div className="font-medium">Check your inbox</div>
              <div className="text-sm text-muted-foreground">
                We&apos;ve sent a sign-in link to <strong>{email}</strong>. Open it on this device to continue.
              </div>
            </div>
          ) : (
            <form onSubmit={onSubmit} className="mt-6 space-y-4">
              <div>
                <label htmlFor="email" className="text-sm font-medium">
                  Email address
                </label>
                <div className="relative mt-1.5">
                  <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.org"
                    className="pl-9"
                    autoComplete="email"
                  />
                </div>
              </div>
              {error && <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}
              <Button type="submit" className="w-full" disabled={loading || !email}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send magic link"}
              </Button>
            </form>
          )}
        </div>
        <p className="mt-6 text-center text-xs text-muted-foreground">
          By signing in you accept that Nyaya is a research aid only.
        </p>
      </div>
    </main>
  );
}
