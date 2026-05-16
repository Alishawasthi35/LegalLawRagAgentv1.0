"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Composer } from "./Composer";
import { StructuredAnswerView } from "./StructuredAnswer";
import { StageIndicator, type StageEvent } from "./StageIndicator";
import type { StructuredAnswer } from "@/lib/types";
import { Scale } from "lucide-react";

interface DBMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content_text: string | null;
  content_json: StructuredAnswer | null;
  created_at: string;
}

interface InflightTurn {
  question: string;
  events: StageEvent[];
  answer?: StructuredAnswer;
  error?: string;
}

export function ChatWindow({
  sessionId: initialSessionId,
  initialMessages
}: {
  sessionId: string | null;
  initialMessages: DBMessage[];
}) {
  const router = useRouter();
  const [sessionId, setSessionId] = useState<string | null>(initialSessionId);
  const [history, setHistory] = useState<DBMessage[]>(initialMessages);
  const [inflight, setInflight] = useState<InflightTurn | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [history.length, inflight?.events.length, inflight?.answer]);

  async function ask(query: string) {
    setInflight({ question: query, events: [] });

    let createdSessionId: string | null = sessionId;

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, session_id: sessionId })
      });
      if (!res.ok || !res.body) {
        const err = await res.text().catch(() => "");
        throw new Error(err || "Request failed");
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const events = buf.split("\n\n");
        buf = events.pop() ?? "";
        for (const block of events) {
          const lines = block.split("\n");
          const eventLine = lines.find((l) => l.startsWith("event:"));
          const dataLine = lines.find((l) => l.startsWith("data:"));
          if (!eventLine || !dataLine) continue;
          const name = eventLine.slice(6).trim();
          let data: any = null;
          try {
            data = JSON.parse(dataLine.slice(5).trim());
          } catch {
            continue;
          }
          handleEvent(name, data);
        }
      }
    } catch (err: any) {
      setInflight((cur) => (cur ? { ...cur, error: err?.message ?? "Agent error" } : cur));
    }

    function handleEvent(name: string, data: any) {
      if (name === "session") {
        // Don't navigate mid-stream — that would unmount this component
        // and lose the SSE connection. We just remember the ID and update
        // the URL after streaming finishes.
        if (!createdSessionId && data.session_id) {
          createdSessionId = data.session_id;
          setSessionId(data.session_id);
        }
      } else if (name === "stage") {
        setInflight((cur) =>
          cur
            ? {
                ...cur,
                events: [...cur.events, { stage: data.stage, message: data.message, data: data.data }]
              }
            : cur
        );
      } else if (name === "answer") {
        setInflight((cur) => (cur ? { ...cur, answer: data } : cur));
      } else if (name === "error") {
        setInflight((cur) => (cur ? { ...cur, error: data.message } : cur));
      } else if (name === "end") {
        const wasInitial = !sessionId;
        const nowIso = new Date().toISOString();
        // Move the completed turn into history. We read the freshest inflight
        // state via the functional updater pattern.
        setInflight((cur) => {
          if (cur) {
            const userMsg: DBMessage = {
              id: `local-u-${Date.now()}`,
              role: "user",
              content_text: cur.question,
              content_json: null,
              created_at: nowIso
            };
            const asstMsg: DBMessage | null = cur.answer
              ? {
                  id: `local-a-${Date.now()}`,
                  role: "assistant",
                  content_text: null,
                  content_json: cur.answer,
                  created_at: nowIso
                }
              : null;
            setHistory((h) => [...h, userMsg, ...(asstMsg ? [asstMsg] : [])]);
          }
          return null;
        });

        // After local state commits, update URL (if this was a new session)
        // and refresh server data so the sidebar picks the session up.
        if (wasInitial && createdSessionId) {
          router.replace(`/app/${createdSessionId}`, { scroll: false });
        } else {
          router.refresh();
        }
      }
    }
  }

  const empty = history.length === 0 && !inflight;

  return (
    <div className="flex h-full flex-col">
      <div ref={scrollRef} className="scrollbar-thin flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl px-4 py-8">
          {empty && <EmptyState onPick={ask} />}

          {history.map((m, idx) => {
            const prevUser = m.role === "assistant" ? findPrevUser(history, idx) : null;
            return (
              <div key={m.id} className="mb-8 animate-fade-in">
                {m.role === "user" ? (
                  <UserBubble text={m.content_text ?? ""} />
                ) : m.content_json ? (
                  <StructuredAnswerView
                    a={m.content_json}
                    question={prevUser?.content_text ?? undefined}
                    messageId={m.id.startsWith("local-") ? undefined : m.id}
                  />
                ) : null}
              </div>
            );
          })}

          {inflight && (
            <div className="mb-8 space-y-4 animate-fade-in">
              <UserBubble text={inflight.question} />
              {!inflight.answer && <StageIndicator events={inflight.events} />}
              {inflight.answer && (
                <StructuredAnswerView a={inflight.answer} question={inflight.question} />
              )}
              {inflight.error && (
                <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                  {inflight.error}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <Composer onSubmit={ask} busy={Boolean(inflight && !inflight.answer && !inflight.error)} />
    </div>
  );
}

function findPrevUser(history: DBMessage[], idx: number): DBMessage | null {
  for (let i = idx - 1; i >= 0; i--) {
    if (history[i].role === "user") return history[i];
  }
  return null;
}

function UserBubble({ text }: { text: string }) {
  return (
    <div className="mb-3 flex justify-end">
      <div className="max-w-[80%] rounded-2xl rounded-tr-sm bg-primary px-4 py-2 text-sm text-primary-foreground">
        {text}
      </div>
    </div>
  );
}

function EmptyState({ onPick }: { onPick: (q: string) => void }) {
  const samples = [
    "Summarise the law on anticipatory bail under §438 CrPC after Sushila Aggarwal",
    "What is the test for mens rea under §138 NI Act for a post-dated cheque?",
    "Compare IPC §302 with BNS §103. What changed in 2023?",
    "Recent Supreme Court rulings on Article 14 and reservations after EWS judgment"
  ];
  return (
    <div className="mx-auto max-w-2xl py-16 text-center">
      <div className="mx-auto mb-4 inline-flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
        <Scale className="h-6 w-6 text-primary" />
      </div>
      <h1 className="font-serif text-3xl font-semibold">Begin your research</h1>
      <p className="mt-3 text-muted-foreground">
        Ask a doctrinal question, a section, or a case. Nyaya will retrieve, rerank, and synthesise a
        structured analysis you can verify.
      </p>
      <div className="mt-8 grid gap-2 text-left sm:grid-cols-2">
        {samples.map((s) => (
          <button
            key={s}
            onClick={() => onPick(s)}
            className="rounded-lg border bg-card p-3 text-sm transition-colors hover:border-primary/40 hover:bg-secondary/30"
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}
