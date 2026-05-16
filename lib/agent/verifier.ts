import { quoteIsGrounded } from "@/lib/utils";
import type { AuthorityClaim, RetrievedChunk, StructuredAnswer } from "@/lib/types";

/**
 * Programmatic verifier — does NOT call the LLM (deterministic, fast).
 *
 * For every authority claim (leading / subsequent / divergence), check that
 * its verbatim_quote substring is grounded in the retrieved context. Claims
 * that fail verification are removed; if all leading authorities fail, the
 * answer is annotated with a warning so the UI can flag it visibly.
 */
export function verify(
  answer: StructuredAnswer,
  chunks: RetrievedChunk[]
): StructuredAnswer {
  const contextTexts = chunks.map((c) => c.text);
  const contextCases = new Set(
    chunks
      .map((c) => c.case_title?.toLowerCase().replace(/[\s,.]+/g, ""))
      .filter(Boolean) as string[]
  );

  const issues: string[] = [];

  const checkBucket = (
    bucket: AuthorityClaim[] | undefined,
    bucketName: string
  ): AuthorityClaim[] => {
    if (!bucket) return [];
    return bucket.flatMap((claim, i) => {
      const quoteOk =
        !claim.verbatim_quote || quoteIsGrounded(claim.verbatim_quote, contextTexts);
      const caseKey = claim.case?.toLowerCase().replace(/[\s,.]+/g, "");
      const caseOk = caseKey ? contextCases.has(caseKey) || nameAppearsAnywhere(claim.case, contextTexts) : false;

      if (!quoteOk && !caseOk) {
        issues.push(`${bucketName}[${i}] "${claim.case}" — no grounding`);
        return []; // remove unverified
      }
      return [{
        ...claim,
        verified: Boolean(quoteOk && caseOk),
        confidence: !quoteOk || !caseOk ? "low" : (claim.confidence ?? "medium")
      }];
    });
  };

  const verified: StructuredAnswer = {
    ...answer,
    leading_authorities: checkBucket(answer.leading_authorities, "leading_authorities"),
    subsequent_application: checkBucket(answer.subsequent_application, "subsequent_application"),
    divergence_or_doubts: checkBucket(answer.divergence_or_doubts, "divergence_or_doubts"),
    caveats: Array.from(
      new Set([
        ...(answer.caveats ?? []),
        "This is a research aid; verify all citations against the original judgment before relying."
      ])
    )
  };

  if (issues.length) {
    verified.meta = {
      ...verified.meta,
      warning: `Verifier removed ${issues.length} unverified claim${issues.length === 1 ? "" : "s"}: ${issues
        .slice(0, 3)
        .join("; ")}${issues.length > 3 ? "…" : ""}`
    };
  }
  return verified;
}

function nameAppearsAnywhere(name: string, contexts: string[]): boolean {
  if (!name) return false;
  const tokens = name.split(/\s+v\.?\s+/i);
  const lead = tokens[0]?.trim();
  if (!lead || lead.length < 3) return false;
  const probe = lead.toLowerCase();
  return contexts.some((c) => c.toLowerCase().includes(probe));
}
