"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Loader2, AlertTriangle, ExternalLink } from "lucide-react";

interface TraceData {
  plan?: any;
  reranked_meta?: Array<{
    case_title?: string;
    citation?: string;
    url?: string;
    source?: string;
    rerank_score?: number;
    para?: number;
  }>;
  elapsed?: { plan_ms: number; retrieve_ms: number; rerank_ms: number; synth_ms: number; verify_ms: number };
}

export function TraceViewer({
  open,
  onClose,
  messageId,
  inlineTrace
}: {
  open: boolean;
  onClose: () => void;
  messageId?: string | null;
  inlineTrace?: TraceData | null;
}) {
  const [trace, setTrace] = useState<TraceData | null>(inlineTrace ?? null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || inlineTrace || !messageId) return;
    setLoading(true);
    setError(null);
    fetch(`/api/messages/${messageId}/trace`)
      .then(async (r) => {
        if (!r.ok) throw new Error("Failed to load trace");
        return r.json();
      })
      .then((d) => setTrace(d.trace))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [open, messageId, inlineTrace]);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Retrieval trace</DialogTitle>
          <DialogDescription>
            What the agent saw before drafting this analysis. Useful for verifying that the model worked
            from the right sources.
          </DialogDescription>
        </DialogHeader>

        {loading && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" /> Loading trace…
          </div>
        )}
        {error && (
          <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            <AlertTriangle className="mt-0.5 h-4 w-4" /> {error}
          </div>
        )}

        {trace && (
          <div className="space-y-5 text-sm">
            {trace.plan && (
              <section>
                <h3 className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Plan
                </h3>
                <div className="rounded-md border bg-secondary/30 p-3">
                  {trace.plan.query_type && (
                    <Badge variant="secondary" className="mb-2">{trace.plan.query_type}</Badge>
                  )}
                  {trace.plan.statutes?.length > 0 && (
                    <div className="mb-2">
                      <span className="text-xs font-medium text-muted-foreground">Statutes: </span>
                      {trace.plan.statutes.map((s: string, i: number) => (
                        <Badge key={i} variant="outline" className="ml-1 font-mono">{s}</Badge>
                      ))}
                    </div>
                  )}
                  {trace.plan.anchor_cases?.length > 0 && (
                    <div className="mb-2 text-xs">
                      <span className="font-medium text-muted-foreground">Anchor cases: </span>
                      {trace.plan.anchor_cases.join("; ")}
                    </div>
                  )}
                  {trace.plan.sub_questions?.length > 0 && (
                    <div>
                      <div className="mb-1 text-xs font-medium text-muted-foreground">Sub-questions</div>
                      <ol className="list-decimal space-y-1 pl-5 text-xs">
                        {trace.plan.sub_questions.map((q: string, i: number) => (
                          <li key={i}>{q}</li>
                        ))}
                      </ol>
                    </div>
                  )}
                </div>
              </section>
            )}

            {trace.reranked_meta && trace.reranked_meta.length > 0 && (
              <section>
                <h3 className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Top {trace.reranked_meta.length} reranked chunks
                </h3>
                <div className="space-y-1.5">
                  {trace.reranked_meta.map((c, i) => (
                    <div key={i} className="flex items-start justify-between gap-3 rounded border bg-card p-2 text-xs">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="font-medium">{c.case_title || "(no title)"}</span>
                          {c.citation && (
                            <Badge variant="secondary" className="font-mono text-[10px]">{c.citation}</Badge>
                          )}
                          {c.para != null && (
                            <span className="text-muted-foreground">¶ {c.para}</span>
                          )}
                        </div>
                        <div className="mt-0.5 text-muted-foreground">
                          source: <span className="font-mono">{c.source}</span>
                          {typeof c.rerank_score === "number" && (
                            <>
                              {" · "}rerank: <span className="font-mono">{c.rerank_score.toFixed(2)}</span>
                            </>
                          )}
                        </div>
                      </div>
                      {c.url && (
                        <a
                          href={c.url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex shrink-0 items-center gap-1 text-primary hover:underline"
                        >
                          Open <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            )}

            {trace.elapsed && (
              <section>
                <h3 className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Stage timings (ms)
                </h3>
                <div className="grid grid-cols-5 gap-2 text-xs">
                  {Object.entries(trace.elapsed).map(([k, v]) => (
                    <div key={k} className="rounded border bg-card p-2 text-center">
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                        {k.replace("_ms", "")}
                      </div>
                      <div className="font-mono">{v}</div>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
