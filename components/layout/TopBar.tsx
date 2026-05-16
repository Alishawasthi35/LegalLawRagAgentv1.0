"use client";

import Link from "next/link";
import { Bookmark, Scale } from "lucide-react";

export function TopBar() {
  return (
    <header className="flex h-14 items-center justify-between border-b bg-background px-6">
      <div className="flex items-center gap-2">
        <Scale className="h-4 w-4 text-primary" />
        <span className="font-serif text-base font-semibold">Nyaya</span>
        <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          Research aid
        </span>
      </div>
      <Link
        href="/bookmarks"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <Bookmark className="h-4 w-4" /> Bookmarks
      </Link>
    </header>
  );
}
