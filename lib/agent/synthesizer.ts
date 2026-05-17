import { geminiText } from "@/lib/gemini";
import { groqText, groqAvailable } from "@/lib/groq";
import { extractJson } from "@/lib/utils";
import type { RetrievedChunk, StructuredAnswer } from "@/lib/types";
import { SYNTHESIZER_SYSTEM, renderContext, synthesizerUserPrompt } from "./prompts";

export async function synthesize(query: string, chunks: RetrievedChunk[]): Promise<StructuredAnswer> {
  const context = renderContext(chunks);
  const userPrompt = synthesizerUserPrompt(query, context);

  let raw: string;
  try {
    raw = await geminiText(userPrompt, {
      systemInstruction: SYNTHESIZER_SYSTEM,
      temperature: 0.15,
      maxOutputTokens: 6144,
      json: true
    });
  } catch (e) {
    if (!groqAvailable()) throw e;
    raw = await groqText(userPrompt, {
      system: SYNTHESIZER_SYSTEM,
      temperature: 0.15,
      json: true
    });
  }

  const parsed = extractJson<StructuredAnswer>(raw);
  // Backfill defaults.
  parsed.applicable_law ??= [];
  parsed.doctrinal_framework ??= [];
  parsed.leading_authorities ??= [];
  parsed.subsequent_application ??= [];
  parsed.divergence_or_doubts ??= [];
  parsed.recent_developments ??= [];
  parsed.practical_guidance ??= [];
  parsed.unresolved_questions ??= [];
  parsed.caveats ??= [
    "This is a research aid; verify all citations against the original judgment before relying."
  ];
  parsed.meta ??= { model: "gemini", retrieved_chunks: chunks.length, sources_used: [] };
  parsed.meta.retrieved_chunks = chunks.length;
  parsed.meta.sources_used = Array.from(new Set(chunks.map((c) => c.source)));
  return parsed;
}
