export type Backend = "claude" | "google_free" | "mymemory";

export type ExtractionSource = "native_pdf" | "ocr" | "claude_vision" | "typed_text";

export interface Extraction {
  text: string;
  source: ExtractionSource;
  /** Average Tesseract word confidence (0-100), or null when not OCR-derived. */
  ocrConfidence: number | null;
}

export interface TranslationResult {
  translation: string;
  /** Model/API self-reported confidence (0-100), or null if not available. */
  modelConfidence: number | null;
  documentTypeGuess: string;
  ambiguousTerms: string[];
  notes: string;
}

export type AccuracyLabel = "High" | "Medium" | "Low";

export interface Metrics {
  accuracyScore: number;
  accuracyLabel: AccuracyLabel;
  ocrConfidence: number | null;
  modelConfidence: number | null;
  extractionSource: ExtractionSource;
  wordCount: number;
  charCount: number;
  arabicCharRatio: number;
}

export interface TranslateApiResponse {
  /** Mongo _id of the saved history record, or null if it couldn't be
   * persisted (e.g. MongoDB temporarily unavailable) — the translation
   * result itself is still returned either way. */
  historyId: string | null;
  createdAt: string;
  sourceText: string;
  translation: string;
  documentTypeGuess: string;
  ambiguousTerms: string[];
  notes: string;
  metrics: Metrics;
  backend: Backend;
  inputKind: "file" | "text";
  fileName: string | null;
  processingTimeSec: number;
}

export interface TranslateApiError {
  error: string;
}
