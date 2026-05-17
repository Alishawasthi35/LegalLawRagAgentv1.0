/**
 * Tavily search — AI-optimised web search. Free tier: 1000 searches/month.
 * Sign up: https://app.tavily.com → API Keys → copy `tvly-...` key.
 *
 * Returns clean snippets specifically tuned for LLM ingestion, which is
 * exactly what we want for legal commentary, news, and doctrinal articles
 * that aren't in our corpus or IndianKanoon.
 */

const ENDPOINT = "https://api.tavily.com/search";

export interface TavilyResult {
  title: string;
  url: string;
  content: string;       // clean snippet, no boilerplate
  score: number;         // 0-1 relevance
  published_date?: string;
}

export interface TavilySearchOpts {
  max_results?: number;
  include_domains?: string[];
  exclude_domains?: string[];
  search_depth?: "basic" | "advanced";
  topic?: "general" | "news";
}

export function tavilyAvailable() {
  return Boolean(process.env.TAVILY_API_KEY);
}

export async function tavilySearch(
  query: string,
  opts: TavilySearchOpts = {}
): Promise<TavilyResult[]> {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) return [];

  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        api_key: apiKey,
        query,
        search_depth: opts.search_depth ?? "basic",
        max_results: opts.max_results ?? 4,
        include_domains: opts.include_domains,
        exclude_domains: opts.exclude_domains,
        topic: opts.topic ?? "general",
        include_answer: false,
        include_raw_content: false,
        include_images: false
      })
    });
    if (!res.ok) {
      // eslint-disable-next-line no-console
      console.warn("[tavily] search failed", res.status);
      return [];
    }
    const json: { results?: TavilyResult[] } = await res.json();
    return json.results ?? [];
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn("[tavily] error", err);
    return [];
  }
}

/** Curated allow-list of Indian legal commentary / news domains for higher signal. */
export const INDIAN_LEGAL_DOMAINS = [
  "livelaw.in",
  "barandbench.com",
  "scconline.com",
  "indiankanoon.org",
  "prsindia.org",
  "lawcommissionofindia.nic.in",
  "main.sci.gov.in",
  "legallyindia.com",
  "lawctopus.com",
  "thewire.in",
  "theleaflet.in",
  "manupatra.com",
  "indiacode.nic.in",
  "doj.gov.in"
];
