"use client";

import { useRef, useState, useEffect } from "react";
import { Send, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export function Composer({
  onSubmit,
  busy,
  placeholder = "Ask about a section, case, or doctrine. e.g., 'Summarise the law on anticipatory bail under §438 CrPC after Sushila Aggarwal'."
}: {
  onSubmit: (text: string) => void;
  busy: boolean;
  placeholder?: string;
}) {
  const [text, setText] = useState("");
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (ref.current) {
      ref.current.style.height = "auto";
      ref.current.style.height = Math.min(ref.current.scrollHeight, 240) + "px";
    }
  }, [text]);

  function submit() {
    const t = text.trim();
    if (!t || busy) return;
    onSubmit(t);
    setText("");
  }

  return (
    <div className="border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/75">
      <div className="mx-auto max-w-3xl px-4 py-4">
        <div className="rounded-xl border bg-card shadow-sm">
          <Textarea
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
            className="min-h-[60px] border-0 focus-visible:ring-0"
            disabled={busy}
          />
          <div className="flex items-center justify-between border-t px-3 py-2">
            <span className="text-xs text-muted-foreground">
              Shift + Enter for newline · Output is grounded in retrieved sources
            </span>
            <Button onClick={submit} disabled={!text.trim() || busy} size="sm">
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
              <span className="ml-1.5">Research</span>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
