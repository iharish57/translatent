import { extractNativePdfText, renderPdfPagesToPng } from "./pdf";
import { ocrPages } from "./ocr";
import { translateClaude, translateClaudeVision } from "./engines/claude";
import { translateGoogleFree } from "./engines/google";
import { translateMyMemory } from "./engines/mymemory";
import { preprocessForVision } from "./image-preprocess";
import type { Backend, Extraction, TranslationResult } from "./types";

/** Extraction path shared by the free/OCR-based backends (Google, MyMemory):
 * native PDF text when available, otherwise Tesseract OCR with layout
 * reconstruction. Images are upscaled/contrast-stretched first so faint or
 * small handwriting has a fighting chance against Tesseract. */
export async function extractText(buffer: Buffer, ext: string): Promise<Extraction> {
  if (ext === "pdf") {
    const native = await extractNativePdfText(buffer);
    if (native) {
      return { text: native, source: "native_pdf", ocrConfidence: null };
    }
    const pages = await renderPdfPagesToPng(buffer);
    const preprocessed = await Promise.all(pages.map(preprocessForVision));
    const { text, avgConfidence } = await ocrPages(preprocessed);
    return { text, source: "ocr", ocrConfidence: avgConfidence };
  }

  const preprocessed = await preprocessForVision(buffer);
  const { text, avgConfidence } = await ocrPages([preprocessed]);
  return { text, source: "ocr", ocrConfidence: avgConfidence };
}

export async function translateWithBackend(
  backend: Exclude<Backend, "claude">,
  arabicText: string
): Promise<TranslationResult> {
  if (backend === "google_free") return translateGoogleFree(arabicText);
  return translateMyMemory(arabicText);
}

/** Decide the fastest reliable path for the Claude backend: native PDF text
 * extraction when available (born-digital PDFs), otherwise the vision
 * pipeline (images, and scanned/handwritten PDFs rendered to page images). */
export async function runClaudePipeline(
  buffer: Buffer,
  ext: string,
  apiKey: string,
  model: string
): Promise<{ extraction: Extraction; translation: TranslationResult }> {
  if (ext === "pdf") {
    const native = await extractNativePdfText(buffer);
    if (native) {
      const translation = await translateClaude(native, apiKey, model);
      return {
        extraction: { text: native, source: "native_pdf", ocrConfidence: null },
        translation,
      };
    }
    const pages = await renderPdfPagesToPng(buffer);
    const preprocessed = await Promise.all(pages.map(preprocessForVision));
    const vision = await translateClaudeVision(preprocessed, apiKey, model);
    return {
      extraction: { text: vision.sourceText, source: "claude_vision", ocrConfidence: null },
      translation: vision.translation,
    };
  }

  const preprocessed = await preprocessForVision(buffer);
  const vision = await translateClaudeVision([preprocessed], apiKey, model);
  return {
    extraction: { text: vision.sourceText, source: "claude_vision", ocrConfidence: null },
    translation: vision.translation,
  };
}
