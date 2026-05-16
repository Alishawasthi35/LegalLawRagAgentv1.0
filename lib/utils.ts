import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(iso?: string) {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export function truncate(s: string, n: number) {
  if (!s) return "";
  return s.length <= n ? s : s.slice(0, n - 1) + "…";
}

export function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Substring-based verification: returns true iff `quote` (after light normalisation)
 * appears within any of the provided context strings. Used by verifier.ts to
 * confirm that every verbatim_quote in the LLM output is actually grounded.
 */
export function quoteIsGrounded(quote: string, contextTexts: string[]): boolean {
  const norm = (s: string) =>
    s
      .toLowerCase()
      .replace(/[‘’“”]/g, "'")
      .replace(/\s+/g, " ")
      .replace(/[.,;:()\[\]"'`]/g, "")
      .trim();
  const q = norm(quote);
  if (q.length < 15) return false;            // too short to verify reliably
  return contextTexts.some((t) => norm(t).includes(q));
}

/** Light JSON extraction — Gemini sometimes wraps JSON in markdown fences. */
export function extractJson<T = unknown>(raw: string): T {
  const trimmed = raw.trim();
  // Strip ```json ... ``` or ``` ... ``` fences
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = fence ? fence[1] : trimmed;
  const first = body.indexOf("{");
  const last = body.lastIndexOf("}");
  const arrFirst = body.indexOf("[");
  const arrLast = body.lastIndexOf("]");
  let candidate = body;
  if (first !== -1 && last !== -1) {
    candidate = body.slice(first, last + 1);
  } else if (arrFirst !== -1 && arrLast !== -1) {
    candidate = body.slice(arrFirst, arrLast + 1);
  }
  return JSON.parse(candidate) as T;
}
