"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Plus,
  Search,
  LogOut,
  MessageSquare,
  MoreHorizontal,
  Trash2,
  Pencil,
  Settings,
  ShieldOff,
  Menu
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger
} from "@/components/ui/sheet";
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
  userEmail,
  isGuest = false
}: {
  sessions: SessionRow[];
  userEmail: string;
  isGuest?: boolean;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Mobile hamburger — fixed to top-left, only visible <md */}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <button
            className="fixed left-3 top-3 z-40 inline-flex h-9 w-9 items-center justify-center rounded-md border bg-card shadow-sm md:hidden"
            aria-label="Open menu"
          >
            <Menu className="h-4 w-4" />
          </button>
        </SheetTrigger>
        <SheetContent side="left" className="w-72 p-0">
          <SheetTitle className="sr-only">Research sessions</SheetTitle>
          <SidebarContent
            sessions={initial}
            userEmail={userEmail}
            isGuest={isGuest}
            onNavigate={() => setOpen(false)}
          />
        </SheetContent>
      </Sheet>

      {/* Desktop sidebar — md+ only */}
      <aside className="hidden h-[100dvh] w-72 flex-col border-r bg-secondary/30 md:flex">
        <SidebarContent sessions={initial} userEmail={userEmail} isGuest={isGuest} />
      </aside>
    </>
  );
}

function SidebarContent({
  sessions: initial,
  userEmail,
  isGuest,
  onNavigate
}: {
  sessions: SessionRow[];
  userEmail: string;
  isGuest: boolean;
  onNavigate?: () => void;
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
    <div className="flex h-full flex-col">
      <div className="flex h-14 items-center border-b px-4">
        <Link
          href="/app"
          onClick={onNavigate}
          className="text-sm font-medium"
        >
          New research
        </Link>
        <Button asChild size="sm" variant="ghost" className="ml-auto h-8 w-8 p-0">
          <Link href="/app" aria-label="New research" onClick={onNavigate}>
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
              <Link
                href={`/app/${s.id}`}
                onClick={onNavigate}
                className="flex flex-1 items-start gap-2 text-sm"
              >
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
          onClick={onNavigate}
          className="mb-2 flex items-center gap-2 rounded-md px-2 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
        >
          <Settings className="h-3.5 w-3.5" /> Settings
        </Link>
        {isGuest ? (
          <div className="rounded-md border border-amber-200 bg-amber-50 px-2 py-1.5 text-[11px] leading-tight text-amber-900">
            <div className="flex items-center gap-1 font-medium">
              <ShieldOff className="h-3 w-3" /> Guest mode
            </div>
            <div className="mt-0.5 opacity-80">Auth disabled — data is shared across all visitors.</div>
          </div>
        ) : (
          <>
            <div className="mb-2 px-2 text-xs text-muted-foreground" title={userEmail}>
              {truncate(userEmail, 28)}
            </div>
            <Button variant="ghost" size="sm" className="w-full justify-start" onClick={signOut}>
              <LogOut className="mr-2 h-3.5 w-3.5" /> Sign out
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
