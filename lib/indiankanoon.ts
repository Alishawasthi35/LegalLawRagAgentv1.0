/**
 * IndianKanoon API client.
 * Docs: https://api.indiankanoon.org/documentation/
 *
 * Auth header:  Authorization: Token <YOUR_TOKEN>
 * All endpoints use POST (per IK convention) with query string params.
 *
 * For non-commercial / academic / judicial use, request the ₹10,000/month
 * free credit on signup — it is more than enough for one researcher.
 */

const BASE = "https://api.indiankanoon.org";
const token = process.env.INDIAN_KANOON_TOKEN;

interface IKHeaders extends Record<string, string> {
  Authorization: string;
  Accept: string;
}

function headers(): IKHeaders {
  if (!token) throw new Error("INDIAN_KANOON_TOKEN not set");
  return { Authorization: `Token ${token}`, Accept: "application/json" };
}

export interface IKSearchHit {
  tid: number;           // doc id
  title: string;
  headline: string;      // HTML snippet
  publishdate: string;   // "YYYY-MM-DD"
  docsource: string;     // "Supreme Court of India" etc.
  docsize: number;
  numcites?: number;
  numcitedby?: number;
  fragment?: string;
  authorid?: number;
}

export interface IKSearchResult {
  docs: IKSearchHit[];
  found: number;
  query: string;
}

export interface IKDoc {
  tid: number;
  title: string;
  doc: string;           // HTML body of the judgment
  publishdate: string;
  docsource: string;
  citeList?: Array<{ tid: number; title: string }>;
  citedbyList?: Array<{ tid: number; title: string }>;
  numcites?: number;
  numcitedby?: number;
  bench?: string;
  citation?: string;
}

export async function ikSearch(
  query: string,
  opts: { pagenum?: number; doctypes?: string; fromdate?: string; todate?: string; maxpages?: number } = {}
): Promise<IKSearchResult> {
  const url = new URL(`${BASE}/search/`);
  url.searchParams.set("formInput", query);
  if (opts.pagenum != null) url.searchParams.set("pagenum", String(opts.pagenum));
  if (opts.doctypes) url.searchParams.set("doctypes", opts.doctypes);
  if (opts.fromdate) url.searchParams.set("fromdate", opts.fromdate);
  if (opts.todate) url.searchParams.set("todate", opts.todate);
  if (opts.maxpages) url.searchParams.set("maxpages", String(opts.maxpages));

  const res = await fetch(url.toString(), { method: "POST", headers: headers() });
  if (!res.ok) {
    throw new Error(`IK search failed (${res.status}): ${await res.text().catch(() => "")}`);
  }
  return res.json();
}

export async function ikDoc(
  tid: number,
  opts: { maxcites?: number; maxcitedby?: number } = {}
): Promise<IKDoc> {
  const url = new URL(`${BASE}/doc/${tid}/`);
  if (opts.maxcites) url.searchParams.set("maxcites", String(opts.maxcites));
  if (opts.maxcitedby) url.searchParams.set("maxcitedby", String(opts.maxcitedby));
  const res = await fetch(url.toString(), { method: "POST", headers: headers() });
  if (!res.ok) {
    throw new Error(`IK doc failed (${res.status}): ${await res.text().catch(() => "")}`);
  }
  return res.json();
}

export async function ikDocFragment(tid: number, query: string): Promise<{ fragment: string }> {
  const url = new URL(`${BASE}/docfragment/${tid}/`);
  url.searchParams.set("formInput", query);
  const res = await fetch(url.toString(), { method: "POST", headers: headers() });
  if (!res.ok) throw new Error(`IK docfragment failed (${res.status})`);
  return res.json();
}

export async function ikDocMeta(tid: number): Promise<Partial<IKDoc>> {
  const res = await fetch(`${BASE}/docmeta/${tid}/`, { method: "POST", headers: headers() });
  if (!res.ok) throw new Error(`IK docmeta failed (${res.status})`);
  return res.json();
}

/** Strip HTML tags to get plain text from an IK doc body. */
export function ikStripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function ikUrl(tid: number) {
  return `https://indiankanoon.org/doc/${tid}/`;
}

/** Detect whether IK token is configured at runtime. */
export function indianKanoonConfigured() {
  return Boolean(token);
}
