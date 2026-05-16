import Groq from "groq-sdk";

const apiKey = process.env.GROQ_API_KEY;

const client = apiKey ? new Groq({ apiKey }) : null;

const DEFAULT_MODEL = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";

export function groqAvailable() {
  return Boolean(client);
}

export async function groqText(
  prompt: string,
  opts: { model?: string; temperature?: number; system?: string; json?: boolean } = {}
): Promise<string> {
  if (!client) throw new Error("GROQ_API_KEY not set");
  const res = await client.chat.completions.create({
    model: opts.model || DEFAULT_MODEL,
    messages: [
      ...(opts.system ? [{ role: "system" as const, content: opts.system }] : []),
      { role: "user" as const, content: prompt }
    ],
    temperature: opts.temperature ?? 0.2,
    response_format: opts.json ? { type: "json_object" } : undefined
  });
  return res.choices[0]?.message?.content ?? "";
}
