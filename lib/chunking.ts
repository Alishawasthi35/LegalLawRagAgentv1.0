/**
 * Paragraph-aware chunking for legal judgments.
 * Strategy: split on judgment paragraphs (numbered "1." / "1)" / blank lines)
 * then merge adjacent paras until ≈ targetTokens. Approximates token count by
 * (chars / 4). Good enough for embedding.
 */

const APPROX_CHARS_PER_TOKEN = 4;

export interface Chunk {
  text: string;
  paraStart: number;
  paraEnd: number;
  tokenCount: number;
}

const PARA_BREAK = /\n\s*\n+/g;
const NUMBERED_PARA = /^\s*(?:\d{1,4})[\.\)]\s+/;

export function chunkJudgment(text: string, targetTokens = 350, maxTokens = 600): Chunk[] {
  // First, attempt to split by numbered paragraphs.
  const lines = text.split("\n");
  const paras: { text: string; num: number }[] = [];
  let buf: string[] = [];
  let currentNum = 0;
  let sawNumber = false;

  for (const line of lines) {
    const m = line.match(/^\s*(\d{1,4})[\.\)]\s+/);
    if (m) {
      if (buf.length) paras.push({ text: buf.join("\n").trim(), num: currentNum });
      buf = [line];
      currentNum = parseInt(m[1], 10);
      sawNumber = true;
    } else {
      buf.push(line);
    }
  }
  if (buf.length) paras.push({ text: buf.join("\n").trim(), num: currentNum });

  // If we never saw numbered paras, fall back to blank-line splitting.
  if (!sawNumber || paras.length < 3) {
    const fallback = text.split(PARA_BREAK).map((t, i) => ({ text: t.trim(), num: i + 1 }));
    return mergeIntoChunks(fallback, targetTokens, maxTokens);
  }

  return mergeIntoChunks(paras, targetTokens, maxTokens);
}

function approxTokens(s: string) {
  return Math.ceil(s.length / APPROX_CHARS_PER_TOKEN);
}

function mergeIntoChunks(
  paras: { text: string; num: number }[],
  target: number,
  max: number
): Chunk[] {
  const chunks: Chunk[] = [];
  let cur: { text: string; num: number }[] = [];
  let curTokens = 0;

  const flush = () => {
    if (!cur.length) return;
    const text = cur.map((p) => p.text).join("\n\n").trim();
    if (!text) {
      cur = [];
      curTokens = 0;
      return;
    }
    chunks.push({
      text,
      paraStart: cur[0].num,
      paraEnd: cur[cur.length - 1].num,
      tokenCount: approxTokens(text)
    });
    cur = [];
    curTokens = 0;
  };

  for (const p of paras) {
    if (!p.text) continue;
    const tk = approxTokens(p.text);
    if (tk > max) {
      // very long single paragraph — hard split by sentence
      flush();
      const sents = p.text.split(/(?<=[.!?])\s+/);
      let sBuf: string[] = [];
      let sTk = 0;
      for (const s of sents) {
        const stk = approxTokens(s);
        if (sTk + stk > target && sBuf.length) {
          chunks.push({
            text: sBuf.join(" "),
            paraStart: p.num,
            paraEnd: p.num,
            tokenCount: sTk
          });
          sBuf = [];
          sTk = 0;
        }
        sBuf.push(s);
        sTk += stk;
      }
      if (sBuf.length) {
        chunks.push({
          text: sBuf.join(" "),
          paraStart: p.num,
          paraEnd: p.num,
          tokenCount: sTk
        });
      }
      continue;
    }
    if (curTokens + tk > target && cur.length) {
      flush();
    }
    cur.push(p);
    curTokens += tk;
  }
  flush();
  return chunks;
}
