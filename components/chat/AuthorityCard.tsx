"use client";

import { useState } from "react";
import { ExternalLink, ShieldCheck, ShieldAlert, Bookmark, BookmarkCheck, Copy } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { toast } from "@/components/ui/use-toast";
import { formatDate } from "@/lib/utils";
import type { AuthorityClaim } from "@/lib/types";

export function AuthorityCard({ a, idx }: { a: AuthorityClaim; idx: number }) {
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  const verifiedTone =
    a.verified && a.confidence === "high"
      ? { Icon: ShieldCheck, color: "text-emerald-700", bg: "bg-emerald-50", label: "Verified · High" }
      : a.verified && a.confidence === "medium"
      ? { Icon: ShieldCheck, color: "text-emerald-700", bg: "bg-emerald-50", label: "Verified · Medium" }
      : { Icon: ShieldAlert, color: "text-amber-700", bg: "bg-amber-50", label: "Low confidence" };

  async function copyCitation() {
    const text = [a.case, a.citation, a.court, a.date ? formatDate(a.date) : ""]
      .filter(Boolean)
      .join(" · ");
    await navigator.clipboard.writeText(text);
    toast({ title: "Citation copied", description: text });
  }

  async function bookmark() {
    if (saved || busy) return;
    setBusy(true);
    try {
      const res = await fetch("/api/bookmarks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          case_id: a.case_id ?? null,
          ik_doc_id: a.ik_doc_id ?? null,
          note: a.holding ?? null,
          tags: a.bench ? [a.bench] : []
        })
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Failed");
      setSaved(true);
      toast({ title: "Bookmarked", description: a.case });
    } catch (err: any) {
      toast({ variant: "destructive", title: "Couldn't bookmark", description: err.message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="group rounded-lg border bg-card p-4 transition-colors hover:border-primary/40">
      <div className="mb-2 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-serif text-[15px] font-semibold leading-snug">
              {idx + 1}. {a.case}
            </span>
            {a.citation && <Badge variant="secondary" className="font-mono text-[10px]">{a.citation}</Badge>}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            {a.court && <span>{a.court}</span>}
            {a.bench && <span>{a.bench}</span>}
            {a.date && <span>{formatDate(a.date)}</span>}
            {a.key_paragraphs && a.key_paragraphs.length > 0 && (
              <span>¶ {a.key_paragraphs.join(", ")}</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <div className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${verifiedTone.bg} ${verifiedTone.color}`}>
            <verifiedTone.Icon className="h-3 w-3" />
            {verifiedTone.label}
          </div>
        </div>
      </div>

      {a.holding && (
        <div className="mb-2 text-sm leading-relaxed">
          <span className="font-medium">Holding: </span>
          {a.holding}
        </div>
      )}

      {a.verbatim_quote && (
        <blockquote className="my-3 border-l-2 border-primary/60 bg-secondary/30 px-4 py-2">
          <span className="legal-quote">{a.verbatim_quote}</span>
        </blockquote>
      )}

      {a.relevance_note && (
        <div className="text-xs text-muted-foreground">
          <span className="font-medium text-foreground">Why it applies: </span>
          {a.relevance_note}
        </div>
      )}

      <div className="mt-3 flex items-center gap-3 text-xs">
        {a.url && (
          <a
            href={a.url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
          >
            Open on IndianKanoon <ExternalLink className="h-3 w-3" />
          </a>
        )}
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={copyCitation}
              className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"
              aria-label="Copy citation"
            >
              <Copy className="h-3.5 w-3.5" /> Copy citation
            </button>
          </TooltipTrigger>
          <TooltipContent>Copy &quot;Case · Citation · Court&quot;</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={bookmark}
              disabled={busy || saved}
              className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground disabled:opacity-50"
              aria-label="Bookmark"
            >
              {saved ? (
                <>
                  <BookmarkCheck className="h-3.5 w-3.5 text-primary" /> Saved
                </>
              ) : (
                <>
                  <Bookmark className="h-3.5 w-3.5" /> Bookmark
                </>
              )}
            </button>
          </TooltipTrigger>
          <TooltipContent>Save to your bookmarks</TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
}
