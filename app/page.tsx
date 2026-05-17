import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Scale, BookOpenCheck, ShieldCheck, Sparkles, ArrowRight, GitBranch, Clock } from "lucide-react";
import { getCurrentUser, AUTH_DISABLED } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function LandingPage() {
  // In guest mode, or for signed-in users, CTAs jump directly to /app.
  // Otherwise the CTAs go to /login.
  const user = AUTH_DISABLED ? null : await getCurrentUser();
  const goToApp = AUTH_DISABLED || Boolean(user);
  const ctaHref = goToApp ? "/app" : "/login";
  const ctaLabel = AUTH_DISABLED ? "Open workspace" : user ? "Continue research" : "Begin research";
  const heroLabel = AUTH_DISABLED ? "Open workspace" : user ? "Open workspace" : "Open the workspace";
  const showSignIn = !AUTH_DISABLED && !user;
  return (
    <main className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container flex h-16 items-center justify-between">
          <Link href="/" className="flex items-center gap-2 font-serif text-xl font-semibold">
            <Scale className="h-5 w-5 text-primary" />
            <span>Nyaya</span>
            <span className="text-xs font-sans uppercase tracking-widest text-muted-foreground">
              Research Aid
            </span>
          </Link>
          <nav className="flex items-center gap-3">
            {showSignIn && (
              <Link href="/login" className="text-sm text-muted-foreground hover:text-foreground">
                Sign in
              </Link>
            )}
            <Button asChild size="sm">
              <Link href={ctaHref}>{ctaLabel}</Link>
            </Button>
          </nav>
        </div>
      </header>

      <section className="container px-4 py-12 sm:py-20">
        <div className="mx-auto max-w-3xl text-center">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border bg-secondary px-3 py-1 text-xs">
            <Sparkles className="h-3 w-3 text-primary" />
            <span className="text-muted-foreground">An agentic RAG system, grounded in Indian case law</span>
          </div>
          <h1 className="font-serif text-3xl font-semibold leading-tight tracking-tight sm:text-5xl">
            A rigorous research desk for the Bench.
          </h1>
          <p className="mt-4 text-base text-muted-foreground sm:mt-6 sm:text-lg">
            Nyaya decomposes your question, searches across IndianKanoon, statutes, and a curated
            corpus, then produces a structured analysis with verbatim quotes and citations you can
            verify in one click. Built for judges who cannot afford a single fabricated citation.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button asChild size="lg" className="w-full sm:w-auto">
              <Link href={ctaHref}>
                {heroLabel} <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="w-full sm:w-auto">
              <Link href="https://github.com" target="_blank" rel="noreferrer">
                View architecture
              </Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="container px-4 pb-16 sm:pb-24">
        <div className="grid gap-4 sm:gap-6 md:grid-cols-2 lg:grid-cols-3">
          <FeatureCard
            icon={<GitBranch className="h-5 w-5" />}
            title="Multi-step legal reasoning"
            body="A planner decomposes each query into sub-questions, runs hybrid retrieval (pgvector + IndianKanoon + statutes) in parallel, reranks with an LLM judge, and synthesises a structured opinion."
          />
          <FeatureCard
            icon={<ShieldCheck className="h-5 w-5" />}
            title="Verified, never invented"
            body="Every claim ships with a verbatim quote that is programmatically checked against the source chunk. Unverified claims are removed. The bottom line: no fake citations."
          />
          <FeatureCard
            icon={<BookOpenCheck className="h-5 w-5" />}
            title="Structured by issue"
            body="Headline → Issue → Applicable Law → Leading Authorities → Subsequent Application → Divergence → Recent Developments → Analysis. Designed for orders, not chatter."
          />
          <FeatureCard
            icon={<Clock className="h-5 w-5" />}
            title="Recency-aware"
            body="A nightly cron ingests yesterday's Supreme Court judgments. Constitution-bench updates trigger an automatic 'has this been doubted?' check on older authorities."
          />
          <FeatureCard
            icon={<Scale className="h-5 w-5" />}
            title="Full audit trail"
            body="Every response stores exactly what the model saw. If a citation looks off, you can re-trace the retrieval that produced it."
          />
          <FeatureCard
            icon={<Sparkles className="h-5 w-5" />}
            title="Built on free infrastructure"
            body="Gemini 2.5 Flash + Supabase pgvector + Vercel. Costs nothing to run, with Groq as automatic fallback if Gemini quota is exhausted."
          />
        </div>
      </section>

      <footer className="border-t">
        <div className="container py-8 text-center text-xs text-muted-foreground">
          Nyaya is a research aid, not a substitute for the original record. All output must be
          verified against the source judgment before relying on it.
        </div>
      </footer>
    </main>
  );
}

function FeatureCard({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="rounded-lg border bg-card p-6 transition-colors hover:bg-secondary/30">
      <div className="mb-3 inline-flex h-9 w-9 items-center justify-center rounded-md bg-primary/10 text-primary">
        {icon}
      </div>
      <h3 className="font-serif text-lg font-semibold">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{body}</p>
    </div>
  );
}
