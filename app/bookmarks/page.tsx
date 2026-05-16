import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ExternalLink, Bookmark } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default async function BookmarksPage() {
  const sb = createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect("/login");

  const { data: bookmarks } = await sb
    .from("bookmarks")
    .select(
      `id, note, tags, created_at,
       case:cases(id, title, citation, court, url),
       statute:statutes(id, act_short, section, heading)`
    )
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  return (
    <main className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container flex h-14 items-center justify-between">
          <Link href="/app" className="text-sm font-medium hover:underline">
            ← Back to workspace
          </Link>
          <h1 className="flex items-center gap-2 font-serif text-lg">
            <Bookmark className="h-4 w-4 text-primary" />
            Bookmarks
          </h1>
        </div>
      </header>

      <div className="container max-w-4xl py-8">
        {(!bookmarks || bookmarks.length === 0) && (
          <div className="rounded-lg border bg-secondary/30 p-12 text-center text-muted-foreground">
            No bookmarks yet. Click the bookmark icon next to any authority in a research result to save it here.
          </div>
        )}
        <div className="space-y-3">
          {(bookmarks ?? []).map((b: any) => (
            <div key={b.id} className="rounded-lg border bg-card p-4">
              {b.case && (
                <>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-serif font-medium">{b.case.title}</span>
                    {b.case.citation && (
                      <Badge variant="secondary" className="font-mono text-[10px]">{b.case.citation}</Badge>
                    )}
                    {b.case.url && (
                      <a
                        className="ml-auto inline-flex items-center gap-1 text-xs text-primary hover:underline"
                        href={b.case.url}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Open <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </div>
                  {b.case.court && <div className="mt-1 text-xs text-muted-foreground">{b.case.court}</div>}
                </>
              )}
              {b.statute && (
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="font-mono">{b.statute.act_short} §{b.statute.section}</Badge>
                  <span>{b.statute.heading}</span>
                </div>
              )}
              {b.note && <p className="mt-2 text-sm">{b.note}</p>}
              {b.tags?.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {b.tags.map((t: string) => (
                    <Badge key={t} variant="outline" className="text-[10px]">{t}</Badge>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
