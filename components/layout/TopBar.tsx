"use client";

import Link from "next/link";
import { Bookmark, Scale, ShieldOff } from "lucide-react";

export function TopBar({ guestMode = false }: { guestMode?: boolean }) {
  return (
    <header className="flex h-14 items-center justify-between border-b bg-background pl-14 pr-4 md:px-6">
      <div className="flex min-w-0 items-center gap-2">
        <Scale className="h-4 w-4 shrink-0 text-primary" />
        <span className="font-serif text-base font-semibold">Nyaya</span>
        {guestMode ? (
          <span className="hidden items-center gap-1 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-amber-900 sm:inline-flex">
            <ShieldOff className="h-3 w-3" /> Guest
          </span>
        ) : (
          <span className="hidden rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground sm:inline">
            Research aid
          </span>
        )}
      </div>
      <Link
        href="/bookmarks"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <Bookmark className="h-4 w-4" />
        <span className="hidden sm:inline">Bookmarks</span>
      </Link>
    </header>
  );
}
