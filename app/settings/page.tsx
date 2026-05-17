import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, CheckCircle2, XCircle, AlertCircle, Database, Cpu, Search, Zap } from "lucide-react";
import { getCurrentUser, getDbClient, AUTH_DISABLED } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/service";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const sb = getDbClient();

  // Provider configuration status (server-side; we only check env presence).
  const providers = [
    {
      icon: <Database className="h-4 w-4" />,
      name: "Supabase",
      configured: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY),
      required: true,
      help: "Database + auth + pgvector"
    },
    {
      icon: <Cpu className="h-4 w-4" />,
      name: "Google Gemini",
      configured: Boolean(process.env.GOOGLE_API_KEY),
      required: true,
      help: "Primary reasoning engine + embeddings"
    },
    {
      icon: <Zap className="h-4 w-4" />,
      name: "Groq (fallback)",
      configured: Boolean(process.env.GROQ_API_KEY),
      required: false,
      help: "Automatic fallback when Gemini RPD is hit"
    },
    {
      icon: <Search className="h-4 w-4" />,
      name: "IndianKanoon",
      configured: Boolean(process.env.INDIAN_KANOON_TOKEN),
      required: true,
      help: "Authoritative live case-law source"
    }
  ];

  // Corpus stats — read counts via service-role to bypass RLS.
  let stats: { cases?: number; chunks?: number; statutes?: number; bookmarks?: number; sessions?: number } = {};
  try {
    const svc = createServiceClient();
    const [c, ch, s] = await Promise.all([
      svc.from("cases").select("id", { head: true, count: "exact" }),
      svc.from("case_chunks").select("id", { head: true, count: "exact" }),
      svc.from("statutes").select("id", { head: true, count: "exact" })
    ]);
    stats.cases = c.count ?? 0;
    stats.chunks = ch.count ?? 0;
    stats.statutes = s.count ?? 0;
  } catch {
    /* swallow */
  }
  const [bk, ses] = await Promise.all([
    sb.from("bookmarks").select("id", { head: true, count: "exact" }).eq("user_id", user.id),
    sb.from("chat_sessions").select("id", { head: true, count: "exact" }).eq("user_id", user.id)
  ]);
  stats.bookmarks = bk.count ?? 0;
  stats.sessions = ses.count ?? 0;

  // Last 7-day usage by provider
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data: usage } = await sb
    .from("api_usage")
    .select("provider, tokens_in, tokens_out")
    .eq("user_id", user.id)
    .gte("created_at", since);
  const usageByProvider = (usage ?? []).reduce<Record<string, { calls: number; tokens: number }>>((acc, row) => {
    const k = row.provider || "unknown";
    if (!acc[k]) acc[k] = { calls: 0, tokens: 0 };
    acc[k].calls += 1;
    acc[k].tokens += (row.tokens_in ?? 0) + (row.tokens_out ?? 0);
    return acc;
  }, {});

  return (
    <main className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container flex h-14 items-center gap-3">
          <Link href="/app" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-3.5 w-3.5" /> Back to workspace
          </Link>
          <h1 className="ml-auto font-serif text-lg">Settings</h1>
        </div>
      </header>

      <div className="container max-w-3xl space-y-8 py-8">
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Providers
          </h2>
          <div className="space-y-2">
            {providers.map((p) => (
              <div key={p.name} className="flex items-center gap-3 rounded-lg border bg-card p-3">
                <div className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-secondary text-primary">
                  {p.icon}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{p.name}</span>
                    {p.required && <Badge variant="outline" className="text-[10px]">Required</Badge>}
                  </div>
                  <div className="text-xs text-muted-foreground">{p.help}</div>
                </div>
                {p.configured ? (
                  <Badge variant="success" className="gap-1">
                    <CheckCircle2 className="h-3 w-3" /> Configured
                  </Badge>
                ) : p.required ? (
                  <Badge variant="destructive" className="gap-1">
                    <XCircle className="h-3 w-3" /> Missing
                  </Badge>
                ) : (
                  <Badge variant="warning" className="gap-1">
                    <AlertCircle className="h-3 w-3" /> Optional
                  </Badge>
                )}
              </div>
            ))}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            To change a key, edit your environment variables in Vercel (Project → Settings → Environment Variables) or your local <code className="rounded bg-muted px-1 py-0.5 font-mono">.env.local</code>.
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Corpus
          </h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Cases" value={stats.cases ?? 0} />
            <Stat label="Chunks" value={stats.chunks ?? 0} />
            <Stat label="Statutes" value={stats.statutes ?? 0} />
            <Stat label="Your sessions" value={stats.sessions ?? 0} />
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Grow the corpus by adding IK doc IDs to <code className="rounded bg-muted px-1 py-0.5 font-mono">scripts/landmark-cases.json</code> and re-running <code className="rounded bg-muted px-1 py-0.5 font-mono">npm run seed:corpus</code>.
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Recent usage (last 7 days)
          </h2>
          {Object.keys(usageByProvider).length === 0 ? (
            <div className="rounded-md border bg-card p-4 text-sm text-muted-foreground">
              No tracked usage yet. The agent logs calls to <code className="rounded bg-muted px-1 py-0.5 font-mono">api_usage</code> as you query.
            </div>
          ) : (
            <div className="space-y-2">
              {Object.entries(usageByProvider).map(([provider, u]) => (
                <div key={provider} className="flex items-center justify-between rounded-md border bg-card p-3 text-sm">
                  <span className="font-medium capitalize">{provider}</span>
                  <span className="text-muted-foreground">
                    {u.calls} call{u.calls === 1 ? "" : "s"} · {u.tokens.toLocaleString()} tokens
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>

        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Health
          </h2>
          <div className="rounded-md border bg-card p-4 text-sm">
            <p className="text-muted-foreground">
              Live connectivity check for every provider. Useful after rotating keys or changing the database.
            </p>
            <a
              href="/api/health"
              target="_blank"
              rel="noreferrer"
              className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
            >
              Run health check →
            </a>
          </div>
        </section>
      </div>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border bg-card p-3 text-center">
      <div className="font-serif text-2xl font-semibold">{value.toLocaleString()}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}
