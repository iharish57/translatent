import { createWorker } from "tesseract.js";
import type Tesseract from "tesseract.js";

export interface OcrPageResult {
  text: string;
  avgConfidence: number | null;
}

/** Reconstruct paragraph/line structure from Tesseract's hierarchical
 * block > paragraph > line > word output, instead of flattening a page to
 * a single line of words. */
function extractLayout(page: Tesseract.Page): OcrPageResult {
  const blocks = page.blocks || [];
  const paragraphTexts: string[] = [];
  const confidences: number[] = [];

  for (const block of blocks) {
    for (const para of block.paragraphs) {
      const lineTexts = para.lines.map((l) => l.text.trim()).filter(Boolean);
      if (lineTexts.length) paragraphTexts.push(lineTexts.join("\n"));
      for (const line of para.lines) {
        for (const word of line.words) {
          if (typeof word.confidence === "number") confidences.push(word.confidence);
        }
      }
    }
  }

  const text = paragraphTexts.join("\n\n").trim();
  const avgConfidence = confidences.length
    ? confidences.reduce((a, b) => a + b, 0) / confidences.length
    : null;
  return { text, avgConfidence };
}

/** OCR one or more page images (PNG buffers) with the Arabic language
 * pack, preserving paragraph/line structure. Reuses a single worker across
 * pages for efficiency. */
export async function ocrPages(pageBuffers: Buffer[]): Promise<OcrPageResult> {
  const worker = await createWorker("ara");
  try {
    const pageTexts: string[] = [];
    const confidences: number[] = [];

    for (const buf of pageBuffers) {
      // tesseract.js defaults `blocks` output to false, so without this the
      // page-level block/paragraph/line structure we rely on for layout
      // reconstruction is always empty even when recognition succeeded.
      const { data } = await worker.recognize(buf, {}, { text: true, blocks: true });
      let { text, avgConfidence } = extractLayout(data);
      // Fall back to Tesseract's flat text if block parsing still comes up
      // empty (e.g. unexpected layout shape) so we don't report "no text"
      // when OCR actually found something.
      if (!text && data.text) text = data.text.trim();
      if (text) pageTexts.push(text);
      if (avgConfidence !== null) confidences.push(avgConfidence);
    }

    return {
      text: pageTexts.join("\n\n").trim(),
      avgConfidence: confidences.length
        ? confidences.reduce((a, b) => a + b, 0) / confidences.length
        : null,
    };
  } finally {
    await worker.terminate();
  }
}
