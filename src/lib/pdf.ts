import { PDFParse } from "pdf-parse";
import { arabicRatio } from "./metrics";

/** Try to pull embedded text directly from a PDF (fast, high quality,
 * typical for born-digital government forms/letters). Returns null if the
 * PDF has no usable embedded text (i.e. it's a scan). */
export async function extractNativePdfText(buffer: Buffer): Promise<string | null> {
  const parser = new PDFParse({ data: buffer });
  try {
    const result = await parser.getText();
    const text = (result.text || "").trim();
    if (text && text.length > 20 && arabicRatio(text) > 0.2) {
      return text;
    }
    return null;
  } catch {
    return null;
  } finally {
    await parser.destroy();
  }
}

/** Render every page of a PDF to a PNG buffer, for OCR or vision-based
 * transcription of scanned/handwritten documents. */
export async function renderPdfPagesToPng(buffer: Buffer, scale = 3): Promise<Buffer[]> {
  const parser = new PDFParse({ data: buffer });
  try {
    const result = await parser.getScreenshot({ scale, imageBuffer: true, imageDataUrl: false });
    return result.pages.map((p) => Buffer.from(p.data));
  } finally {
    await parser.destroy();
  }
}
