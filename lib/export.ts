import type { StructuredAnswer } from "@/lib/types";
import { formatDate } from "./utils";

/**
 * Render a StructuredAnswer as a clean Markdown brief — designed to paste
 * directly into a draft order or research note.
 */
export function answerToMarkdown(a: StructuredAnswer, question?: string): string {
  const lines: string[] = [];
  lines.push(`# ${a.headline}`);
  lines.push("");
  if (question) {
    lines.push(`> **Query:** ${question}`);
    lines.push("");
  }
  if (a.issue) {
    lines.push(`**Issue:** ${a.issue}`);
    lines.push("");
  }

  if (a.applicable_law?.length) {
    lines.push(`## Applicable Law`);
    for (const s of a.applicable_law) {
      lines.push(`- **${s.source}**${s.in_force === false ? " *(not in force)*" : ""}`);
      if (s.text_verbatim) lines.push(`  > ${s.text_verbatim.replace(/\n/g, "\n  > ")}`);
      if (s.url) lines.push(`  [Open](${s.url})`);
    }
    lines.push("");
  }

  const renderAuthorities = (header: string, list?: typeof a.leading_authorities) => {
    if (!list?.length) return;
    lines.push(`## ${header}`);
    list.forEach((c, i) => {
      const head = [c.case, c.citation, c.court, c.bench, c.date ? formatDate(c.date) : ""]
        .filter(Boolean)
        .join(" · ");
      lines.push(`### ${i + 1}. ${head}`);
      if (c.holding) lines.push(`**Holding:** ${c.holding}`);
      if (c.verbatim_quote) {
        lines.push("");
        lines.push(`> *"${c.verbatim_quote}"*`);
      }
      if (c.key_paragraphs?.length) lines.push(`**¶** ${c.key_paragraphs.join(", ")}`);
      if (c.relevance_note) lines.push(`*Relevance:* ${c.relevance_note}`);
      const tags: string[] = [];
      tags.push(`Confidence: ${c.confidence}`);
      tags.push(c.verified ? "Verified" : "Unverified");
      lines.push(`_${tags.join(" · ")}_`);
      if (c.url) lines.push(`[Open on IndianKanoon](${c.url})`);
      lines.push("");
    });
  };

  renderAuthorities("Leading Authorities", a.leading_authorities);
  renderAuthorities("Subsequent Application", a.subsequent_application);
  renderAuthorities("Divergence / Doubts", a.divergence_or_doubts);

  if (a.recent_developments?.length) {
    lines.push(`## Recent Developments`);
    for (const r of a.recent_developments) {
      lines.push(`- **${r.title}** (${r.source}${r.date ? ", " + formatDate(r.date) : ""}) — ${r.summary}`);
      if (r.url) lines.push(`  [Source](${r.url})`);
    }
    lines.push("");
  }

  if (a.analysis) {
    lines.push(`## Analysis`);
    lines.push(a.analysis);
    lines.push("");
  }

  if (a.unresolved_questions?.length) {
    lines.push(`## Unresolved Questions`);
    for (const q of a.unresolved_questions) lines.push(`- ${q}`);
    lines.push("");
  }

  if (a.caveats?.length) {
    lines.push(`---`);
    lines.push(`**Caveats:**`);
    for (const c of a.caveats) lines.push(`- ${c}`);
  }

  return lines.join("\n").trim() + "\n";
}

/** Trigger a download of `content` as a file named `filename`. */
export function downloadAsFile(content: string, filename: string, type = "text/markdown") {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
