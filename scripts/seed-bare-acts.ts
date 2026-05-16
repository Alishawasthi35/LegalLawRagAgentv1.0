/**
 * One-time: load bare-act sections into Supabase with embeddings.
 * Run:  npm run seed:bare-acts
 *
 * Expects the following env vars (load .env.local first via your shell, or
 * use `dotenv-cli`):
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   GOOGLE_API_KEY
 */

import { readFileSync } from "fs";
import path from "path";
import { createServiceClient } from "@/lib/supabase/service";
import { geminiEmbedBatch } from "@/lib/gemini";

interface BareActRow {
  act: string;
  act_short: string;
  section: string;
  subsection?: string;
  heading?: string;
  text: string;
  chapter?: string;
  in_force?: boolean;
}

async function main() {
  const file = path.join(process.cwd(), "scripts", "bare-acts-seed.json");
  const data = JSON.parse(readFileSync(file, "utf-8")) as BareActRow[];
  console.log(`Loaded ${data.length} sections`);

  const supabase = createServiceClient();

  // Embed in batches.
  const BATCH = 25;
  for (let i = 0; i < data.length; i += BATCH) {
    const batch = data.slice(i, i + BATCH);
    const texts = batch.map((b) => `${b.act_short} §${b.section} — ${b.heading ?? ""}\n${b.text}`);
    console.log(`Embedding ${i + 1}..${i + batch.length}`);
    const embeddings = await geminiEmbedBatch(texts);
    const rows = batch.map((b, j) => ({
      act: b.act,
      act_short: b.act_short,
      section: b.section,
      subsection: b.subsection ?? null,
      heading: b.heading ?? null,
      text: b.text,
      chapter: b.chapter ?? null,
      in_force: b.in_force ?? true,
      embedding: embeddings[j] as unknown as string
    }));
    const { error } = await supabase
      .from("statutes")
      .upsert(rows, { onConflict: "act_short,section,subsection" });
    if (error) {
      console.error("Insert failed:", error.message);
      process.exit(1);
    }
  }
  console.log("Done.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
