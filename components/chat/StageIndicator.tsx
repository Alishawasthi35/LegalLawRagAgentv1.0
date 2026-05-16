"use client";

import { Loader2, CheckCircle2 } from "lucide-react";

export interface StageEvent {
  stage: "planning" | "retrieving" | "reranking" | "synthesizing" | "verifying" | "done";
  message?: string;
  data?: any;
}

const ORDER: StageEvent["stage"][] = [
  "planning",
  "retrieving",
  "reranking",
  "synthesizing",
  "verifying",
  "done"
];

const LABELS: Record<StageEvent["stage"], string> = {
  planning: "Decomposing query",
  retrieving: "Hybrid retrieval",
  reranking: "Reranking",
  synthesizing: "Synthesising analysis",
  verifying: "Verifying citations",
  done: "Done"
};

export function StageIndicator({ events }: { events: StageEvent[] }) {
  const reached = new Set(events.map((e) => e.stage));
  const last = events[events.length - 1]?.stage;

  return (
    <div className="rounded-lg border bg-card p-4">
      <ol className="space-y-1.5">
        {ORDER.map((s) => {
          const isDone = reached.has(s) && s !== last;
          const isActive = s === last && s !== "done";
          const isFinal = s === "done" && reached.has("done");
          const status: "done" | "active" | "pending" = isFinal || isDone ? "done" : isActive ? "active" : "pending";
          const msg = events.findLast?.((e) => e.stage === s)?.message;
          return (
            <li key={s} className="flex items-center gap-2 text-sm">
              {status === "done" && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />}
              {status === "active" && <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />}
              {status === "pending" && <span className="h-3.5 w-3.5 rounded-full border" />}
              <span className={status === "pending" ? "text-muted-foreground" : ""}>
                {LABELS[s]}
                {msg && status === "active" && (
                  <span className="ml-2 text-xs text-muted-foreground">{msg}</span>
                )}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
