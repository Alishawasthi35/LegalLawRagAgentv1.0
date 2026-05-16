"use client";

import { useState } from "react";
import { AlertTriangle, Gavel, BookOpen, GitBranch, ScrollText, Sparkles, TimerReset } from "lucide-react";
import { AuthorityCard } from "./AuthorityCard";
import { MessageActions } from "./MessageActions";
import { TraceViewer } from "./TraceViewer";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import type { StructuredAnswer } from "@/lib/types";
import { formatDate } from "@/lib/utils";

export function StructuredAnswerView({
  a,
  question,
  messageId,
  inlineTrace
}: {
  a: StructuredAnswer;
  question?: string;
  messageId?: string;
  inlineTrace?: any;
}) {
  const [traceOpen, setTraceOpen] = useState(false);
  return (
    <article className="animate-slide-up space-y-6">
      {/* Headline */}
      <header className="rounded-lg border bg-card p-5">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <Badge variant="default">{labelForType(a.query_type)}</Badge>
          {a.meta?.warning && (
            <Badge variant="warning" className="gap-1">
              <AlertTriangle className="h-3 w-3" /> {a.meta.warning}
            </Badge>
          )}
          {typeof a.meta?.elapsed_ms === "number" && (
            <span className="text-xs text-muted-foreground">
              {(a.meta.elapsed_ms / 1000).toFixed(1)}s · {a.meta.retrieved_chunks ?? 0} chunks ·{" "}
              {(a.meta.sources_used ?? []).join(", ")}
            </span>
          )}
        </div>
        <h2 className="font-serif text-xl font-semibold leading-snug">{a.headline}</h2>
        {a.issue && <p className="mt-2 text-sm text-muted-foreground">{a.issue}</p>}
      </header>

      {/* Applicable law */}
      {a.applicable_law?.length > 0 && (
        <Section icon={<BookOpen className="h-4 w-4" />} title="Applicable law">
          <div className="space-y-3">
            {a.applicable_law.map((s, i) => (
              <div key={i} className="rounded-md border bg-card p-3">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="font-mono">{s.source}</Badge>
                  {s.in_force === false && (
                    <Badge variant="destructive" className="text-[10px]">Not in force</Badge>
                  )}
                  {s.url && (
                    <a className="ml-auto text-xs text-primary hover:underline" href={s.url} target="_blank" rel="noreferrer">
                      Open
                    </a>
                  )}
                </div>
                <p className="mt-2 text-sm leading-relaxed legal-quote">{s.text_verbatim}</p>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Leading authorities */}
      {a.leading_authorities?.length > 0 && (
        <Section icon={<Gavel className="h-4 w-4" />} title="Leading authorities">
          <div className="space-y-3">
            {a.leading_authorities.map((c, i) => (
              <AuthorityCard key={i} a={c} idx={i} />
            ))}
          </div>
        </Section>
      )}

      {/* Subsequent application */}
      {(a.subsequent_application ?? []).length > 0 && (
        <Section icon={<ScrollText className="h-4 w-4" />} title="Subsequent application">
          <div className="space-y-3">
            {a.subsequent_application!.map((c, i) => (
              <AuthorityCard key={i} a={c} idx={i} />
            ))}
          </div>
        </Section>
      )}

      {/* Divergence */}
      {(a.divergence_or_doubts ?? []).length > 0 && (
        <Section icon={<GitBranch className="h-4 w-4" />} title="Divergence / doubts">
          <div className="space-y-3">
            {a.divergence_or_doubts!.map((c, i) => (
              <AuthorityCard key={i} a={c} idx={i} />
            ))}
          </div>
        </Section>
      )}

      {/* Recent developments */}
      {(a.recent_developments ?? []).length > 0 && (
        <Section icon={<TimerReset className="h-4 w-4" />} title="Recent developments">
          <div className="space-y-2">
            {a.recent_developments!.map((r, i) => (
              <div key={i} className="rounded-md border bg-card p-3 text-sm">
                <div className="mb-1 flex flex-wrap items-center gap-2">
                  <Badge variant="secondary" className="text-[10px]">{r.source}</Badge>
                  <span className="font-medium">{r.title}</span>
                  {r.date && <span className="text-xs text-muted-foreground">{formatDate(r.date)}</span>}
                </div>
                <p className="text-sm text-muted-foreground">{r.summary}</p>
                {r.url && (
                  <a className="mt-1 inline-block text-xs text-primary hover:underline" href={r.url} target="_blank" rel="noreferrer">
                    View source
                  </a>
                )}
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Analysis */}
      {a.analysis && (
        <Section icon={<Sparkles className="h-4 w-4" />} title="Analysis">
          <div className="rounded-md border bg-card p-4 text-[15px] leading-relaxed whitespace-pre-wrap">
            {renderInlineCitations(a.analysis)}
          </div>
        </Section>
      )}

      {/* Unresolved */}
      {(a.unresolved_questions ?? []).length > 0 && (
        <Section icon={<AlertTriangle className="h-4 w-4" />} title="Unresolved questions">
          <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
            {a.unresolved_questions!.map((q, i) => (
              <li key={i}>{q}</li>
            ))}
          </ul>
        </Section>
      )}

      <Separator />

      {/* Caveats */}
      <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
        <div className="mb-1 flex items-center gap-1.5 font-medium">
          <AlertTriangle className="h-3.5 w-3.5" /> Caveats
        </div>
        <ul className="list-disc space-y-0.5 pl-5">
          {(a.caveats ?? []).map((c, i) => (
            <li key={i}>{c}</li>
          ))}
        </ul>
      </div>

      {/* Actions */}
      <div className="overflow-hidden rounded-md border">
        <MessageActions
          answer={a}
          question={question}
          onViewTrace={messageId || inlineTrace ? () => setTraceOpen(true) : undefined}
        />
      </div>

      {(messageId || inlineTrace) && (
        <TraceViewer
          open={traceOpen}
          onClose={() => setTraceOpen(false)}
          messageId={messageId}
          inlineTrace={inlineTrace}
        />
      )}
    </article>
  );
}

function Section({
  icon,
  title,
  children
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
        <span className="text-primary">{icon}</span>
        {title}
      </h3>
      {children}
    </section>
  );
}

/** Render inline [#N] citation markers as superscript pills. */
function renderInlineCitations(text: string): React.ReactNode {
  const parts: React.ReactNode[] = [];
  const re = /\[#(\d+)\]/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    parts.push(
      <sup key={`c${i++}`} className="ml-0.5 rounded bg-primary/10 px-1 text-[10px] font-medium text-primary">
        {m[1]}
      </sup>
    );
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}
