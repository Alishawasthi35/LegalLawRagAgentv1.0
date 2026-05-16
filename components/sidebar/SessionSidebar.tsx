"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Plus, Search, LogOut, MessageSquare, MoreHorizontal, Trash2, Pencil, Settings } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator
} from "@/components/ui/dropdown-menu";
import { toast } from "@/components/ui/use-toast";
import { cn, truncate } from "@/lib/utils";

interface SessionRow {
  id: string;
  title: string;
  updated_at: string;
}

export function SessionSidebar({
  sessions: initial,
  userEmail
}: {
  sessions: SessionRow[];
  userEmail: string;
}) {
  const [q, setQ] = useState("");
  const [sessions, setSessions] = useState<SessionRow[]>(initial);
  const path = usePathname();
  const router = useRouter();

  const filtered = q
    ? sessions.filter((s) => s.title.toLowerCase().includes(q.toLowerCase()))
    : sessions;

  async function signOut() {
    const sb = createClient();
    await sb.auth.signOut();
    router.push("/");
  }

  async function deleteSession(id: string) {
    const ok = window.confirm("Delete this research session? This cannot be undone.");
    if (!ok) return;
    const res = await fetch(`/api/sessions/${id}`, { method: "DELETE" });
    if (!res.ok) {
      toast({ variant: "destructive", title: "Couldn't delete" });
      return;
    }
    setSessions((s) => s.filter((x) => x.id !== id));
    toast({ title: "Session deleted" });
    if (path?.endsWith(`/app/${id}`)) router.push("/app");
    else router.refresh();
  }

  async function rename(id: string, currentTitle: string) {
    const next = window.prompt("Rename research session", currentTitle);
    if (!next || !next.trim() || next === currentTitle) return;
    const res = await fetch(`/api/sessions/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: next.trim() })
    });
    if (!res.ok) {
      toast({ variant: "destructive", title: "Couldn't rename" });
      return;
    }
    setSessions((s) => s.map((x) => (x.id === id ? { ...x, title: next.trim() } : x)));
    toast({ title: "Renamed" });
  }

  return (
    <aside className="hidden h-screen w-72 flex-col border-r bg-secondary/30 md:flex">
      <div className="flex h-14 items-center border-b px-4">
        <Link href="/app" className="text-sm font-medium">
          New research
        </Link>
        <Button asChild size="sm" variant="ghost" className="ml-auto h-8 w-8 p-0">
          <Link href="/app" aria-label="New research">
            <Plus className="h-4 w-4" />
          </Link>
        </Button>
      </div>

      <div className="border-b p-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search history"
            className="h-9 pl-8 text-sm"
          />
        </div>
      </div>

      <nav className="scrollbar-thin flex-1 overflow-y-auto p-2">
        {filtered.length === 0 && (
          <div className="px-3 py-8 text-center text-xs text-muted-foreground">
            No sessions yet. Ask your first question to begin.
          </div>
        )}
        {filtered.map((s) => {
          const active = path?.endsWith(`/app/${s.id}`);
          return (
            <div
              key={s.id}
              className={cn(
                "group/row mb-0.5 flex items-start gap-2 rounded-md px-2 py-1.5 transition-colors hover:bg-background",
                active && "bg-background shadow-sm"
              )}
            >
              <Link href={`/app/${s.id}`} className="flex flex-1 items-start gap-2 text-sm">
                <MessageSquare className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <span className="line-clamp-2 leading-snug">{truncate(s.title, 80)}</span>
              </Link>
              <DropdownMenu>
                <DropdownMenuTrigger
                  className="rounded p-1 opacity-0 transition-opacity hover:bg-secondary group-hover/row:opacity-100 data-[state=open]:opacity-100"
                  aria-label="Session actions"
                >
                  <MoreHorizontal className="h-3.5 w-3.5 text-muted-foreground" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onSelect={() => rename(s.id, s.title)}>
                    <Pencil className="h-3 w-3" /> Rename
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onSelect={() => deleteSession(s.id)}
                    className="text-destructive focus:text-destructive"
                  >
                    <Trash2 className="h-3 w-3" /> Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          );
        })}
      </nav>

      <div className="border-t p-3">
        <Link
          href="/settings"
          className="mb-2 flex items-center gap-2 rounded-md px-2 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
        >
          <Settings className="h-3.5 w-3.5" /> Settings
        </Link>
        <div className="mb-2 px-2 text-xs text-muted-foreground" title={userEmail}>
          {truncate(userEmail, 28)}
        </div>
        <Button variant="ghost" size="sm" className="w-full justify-start" onClick={signOut}>
          <LogOut className="mr-2 h-3.5 w-3.5" /> Sign out
        </Button>
      </div>
    </aside>
  );
}
