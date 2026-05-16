import {
  GoogleGenerativeAI,
  HarmBlockThreshold,
  HarmCategory,
  type GenerationConfig
} from "@google/generative-ai";

const apiKey = process.env.GOOGLE_API_KEY;
if (!apiKey && typeof window === "undefined") {
  // Only warn server-side; client should never see this module.
  // eslint-disable-next-line no-console
  console.warn("[gemini] GOOGLE_API_KEY is not set");
}

const genAI = new GoogleGenerativeAI(apiKey || "");

// Disable Gemini's safety blocks for legal content (false positives on
// statutes describing offences are common). We still have our own verifier.
const SAFETY = [
  { category: HarmCategory.HARM_CATEGORY_HARASSMENT,         threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,        threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,  threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,  threshold: HarmBlockThreshold.BLOCK_NONE }
];

const DEFAULT_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";
const EMBED_MODEL = process.env.GEMINI_EMBED_MODEL || "text-embedding-004";

export interface GeminiCallOpts {
  model?: string;
  temperature?: number;
  maxOutputTokens?: number;
  systemInstruction?: string;
  json?: boolean;
}

export async function geminiText(prompt: string, opts: GeminiCallOpts = {}): Promise<string> {
  const config: GenerationConfig = {
    temperature: opts.temperature ?? 0.2,
    maxOutputTokens: opts.maxOutputTokens ?? 4096,
    responseMimeType: opts.json ? "application/json" : "text/plain"
  };
  const model = genAI.getGenerativeModel({
    model: opts.model || DEFAULT_MODEL,
    safetySettings: SAFETY,
    systemInstruction: opts.systemInstruction
  });
  const res = await model.generateContent({
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: config
  });
  return res.response.text();
}

export async function* geminiStream(
  prompt: string,
  opts: GeminiCallOpts = {}
): AsyncGenerator<string> {
  const config: GenerationConfig = {
    temperature: opts.temperature ?? 0.2,
    maxOutputTokens: opts.maxOutputTokens ?? 8192,
    responseMimeType: opts.json ? "application/json" : "text/plain"
  };
  const model = genAI.getGenerativeModel({
    model: opts.model || DEFAULT_MODEL,
    safetySettings: SAFETY,
    systemInstruction: opts.systemInstruction
  });
  const stream = await model.generateContentStream({
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: config
  });
  for await (const chunk of stream.stream) {
    const t = chunk.text();
    if (t) yield t;
  }
}

export async function geminiEmbed(text: string): Promise<number[]> {
  const model = genAI.getGenerativeModel({ model: EMBED_MODEL });
  const res = await model.embedContent(text);
  return res.embedding.values;
}

export async function geminiEmbedBatch(texts: string[]): Promise<number[][]> {
  // text-embedding-004 supports batchEmbedContents.
  const model = genAI.getGenerativeModel({ model: EMBED_MODEL });
  const res = await model.batchEmbedContents({
    requests: texts.map((t) => ({
      content: { role: "user", parts: [{ text: t }] }
    })) as any
  });
  return res.embeddings.map((e) => e.values);
}
