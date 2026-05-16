"use client";

import { Copy, Download, FileText, Eye } from "lucide-react";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { toast } from "@/components/ui/use-toast";
import { answerToMarkdown, downloadAsFile } from "@/lib/export";
import type { StructuredAnswer } from "@/lib/types";

export function MessageActions({
  answer,
  question,
  onViewTrace
}: {
  answer: StructuredAnswer;
  question?: string;
  onViewTrace?: () => void;
}) {
  async function copyMd() {
    const md = answerToMarkdown(answer, question);
    await navigator.clipboard.writeText(md);
    toast({ title: "Copied as memo", description: "Markdown copied to clipboard" });
  }

  function downloadMd() {
    const md = answerToMarkdown(answer, question);
    const slug = answer.headline
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 60);
    downloadAsFile(md, `${slug || "nyaya-research"}.md`);
  }

  return (
    <div className="flex items-center gap-1 border-t bg-secondary/30 px-2 py-1.5 text-xs text-muted-foreground">
      <Tooltip>
        <TooltipTrigger asChild>
          <button onClick={copyMd} className="inline-flex items-center gap-1 rounded px-2 py-1 hover:bg-background">
            <Copy className="h-3 w-3" /> Copy as memo
          </button>
        </TooltipTrigger>
        <TooltipContent>Copy this analysis as Markdown</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <button onClick={downloadMd} className="inline-flex items-center gap-1 rounded px-2 py-1 hover:bg-background">
            <Download className="h-3 w-3" /> Download .md
          </button>
        </TooltipTrigger>
        <TooltipContent>Save to disk</TooltipContent>
      </Tooltip>
      {onViewTrace && (
        <Tooltip>
          <TooltipTrigger asChild>
            <button onClick={onViewTrace} className="inline-flex items-center gap-1 rounded px-2 py-1 hover:bg-background">
              <Eye className="h-3 w-3" /> View retrieval trace
            </button>
          </TooltipTrigger>
          <TooltipContent>See what the model retrieved</TooltipContent>
        </Tooltip>
      )}
      <div className="ml-auto flex items-center gap-1 pr-1 text-[10px] opacity-70">
        <FileText className="h-3 w-3" />
        {answer.meta?.model ?? "gemini"}
      </div>
    </div>
  );
}
