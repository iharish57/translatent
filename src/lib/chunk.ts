/** Split text into chunks no longer than maxLen, breaking on sentence/
 * whitespace boundaries where possible so we don't cut mid-word. */
export function chunkText(text: string, maxLen: number): string[] {
  text = text.trim();
  if (text.length <= maxLen) return text ? [text] : [];

  const chunks: string[] = [];
  let remaining = text;
  while (remaining.length) {
    if (remaining.length <= maxLen) {
      chunks.push(remaining);
      break;
    }
    const window = remaining.slice(0, maxLen);
    const splitAt = Math.max(
      window.lastIndexOf(". "),
      window.lastIndexOf("\n"),
      window.lastIndexOf(" ")
    );
    const cut = splitAt > 0 ? splitAt : maxLen;
    chunks.push(remaining.slice(0, cut).trim());
    remaining = remaining.slice(cut).trim();
  }
  return chunks.filter(Boolean);
}

/** Matches common bullet/list markers at the start of a line: -, *, •, ●, ▪,
 * –, or a number/letter (incl. Arabic-indic digits) followed by "." or ")". */
const BULLET_RE = /^(\s*)([•\-*●▪–]|[0-9]+[.)]|[٠-٩]+[.)]|[a-zA-Z][.)])\s*(.*)$/;

export type ChunkTranslateFn = (chunk: string) => Promise<{ text: string; score: number | null }>;

/**
 * Translate text while preserving its paragraph/line/bullet structure —
 * plain translation APIs (unlike Claude) don't reliably keep line breaks
 * and list markers on their own, so we split the source by structure first
 * and translate piece by piece.
 */
export async function translateStructured(
  arabicText: string,
  translateChunkFn: ChunkTranslateFn,
  maxLen: number
): Promise<{ text: string; scores: number[] }> {
  const lines = arabicText.split("\n");
  const outputLines: string[] = [];
  const scores: number[] = [];
  let paragraphBuffer: string[] = [];

  async function translatePiece(piece: string): Promise<string> {
    const chunks = chunkText(piece, maxLen);
    const results: string[] = [];
    for (const c of chunks) {
      if (!c.trim()) continue;
      const { text, score } = await translateChunkFn(c);
      if (text) results.push(text.trim());
      if (score !== null && score !== undefined) scores.push(score);
    }
    return results.join(" ");
  }

  async function flushParagraph() {
    if (paragraphBuffer.length) {
      const joined = paragraphBuffer.join("\n");
      outputLines.push(await translatePiece(joined));
      paragraphBuffer = [];
    }
  }

  for (const line of lines) {
    const stripped = line.trim();
    if (!stripped) {
      await flushParagraph();
      outputLines.push("");
      continue;
    }
    const m = BULLET_RE.exec(line);
    if (m) {
      await flushParagraph();
      const [, indent, marker, rest] = m;
      const translatedRest = rest.trim() ? await translatePiece(rest) : "";
      outputLines.push(`${indent}${marker} ${translatedRest}`.trimEnd());
    } else {
      paragraphBuffer.push(line);
    }
  }
  await flushParagraph();

  const text = outputLines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
  return { text, scores };
}
