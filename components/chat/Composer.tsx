"use client";

import { useRef, useState, useEffect } from "react";
import { ArrowUp, Loader2 } from "lucide-react";

export function Composer({
  onSubmit,
  busy,
  placeholder = "Ask about a section, case, or doctrine…"
}: {
  onSubmit: (text: string) => void;
  busy: boolean;
  placeholder?: string;
}) {
  const [text, setText] = useState("");
  const ref = useRef<HTMLTextAreaElement>(null);

  // Auto-grow the textarea up to a max height.
  useEffect(() => {
    if (ref.current) {
      ref.current.style.height = "auto";
      ref.current.style.height = Math.min(ref.current.scrollHeight, 200) + "px";
    }
  }, [text]);

  function submit() {
    const t = text.trim();
    if (!t || busy) return;
    onSubmit(t);
    setText("");
  }

  const canSend = text.trim().length > 0 && !busy;

  return (
    <div className="px-4 pb-6 pt-2">
      <div className="mx-auto max-w-3xl">
        <div
          className={`group relative flex items-end gap-2 rounded-3xl border bg-card px-4 py-3 shadow-[0_2px_10px_-3px_rgba(0,0,0,0.08)] transition-all
            ${busy ? "opacity-70" : "hover:shadow-[0_4px_18px_-3px_rgba(0,0,0,0.12)] focus-within:border-primary/50 focus-within:shadow-[0_4px_18px_-3px_rgba(0,0,0,0.18)]"}`}
        >
          <textarea
            ref={ref}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
            }}
            placeholder={placeholder}
            disabled={busy}
            rows={1}
            className="flex-1 resize-none border-0 bg-transparent text-[15px] leading-relaxed text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus:ring-0 disabled:opacity-60"
          />
          <button
            onClick={submit}
            disabled={!canSend}
            aria-label="Send"
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-all
              ${canSend
                ? "bg-primary text-primary-foreground hover:bg-primary/90 active:scale-95"
                : "bg-muted text-muted-foreground"}`}
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUp className="h-4 w-4" strokeWidth={2.5} />}
          </button>
        </div>
        <p className="mt-2 text-center text-[11px] text-muted-foreground/70">
          Output is grounded in retrieved sources. Verify every citation before relying.
        </p>
      </div>
    </div>
  );
}
