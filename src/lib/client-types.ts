import type { Backend, TranslateApiResponse } from "./types";

export type EntryStatus = "loading" | "done" | "error";

export interface HistoryEntry {
  /** Client-side key. Equal to the server historyId once status is "done"
   * and the entry was persisted, otherwise a locally generated placeholder. */
  id: string;
  status: EntryStatus;
  title: string;
  backend: Backend;
  timestamp: Date;
  data: TranslateApiResponse | null;
  error: string | null;
}

export const EXTRACTION_LABELS: Record<string, string> = {
  ocr: "Tesseract OCR",
  native_pdf: "Native PDF text",
  claude_vision: "Claude vision (handwriting-capable)",
  typed_text: "Typed text",
};

export const ENGINE_LABELS: Record<Backend, string> = {
  claude: "Claude",
  google_free: "Google",
  mymemory: "MyMemory",
};

export const BACKEND_HINTS: Record<Backend, string> = {
  claude:
    "Best quality; handles handwriting and poor scans via vision. Needs an API key with credits.",
  google_free:
    "Free, no key. Usually the best-quality free option, but an unofficial endpoint that can occasionally be rate-limited.",
  mymemory: "Free, no key. Returns a genuine match/quality score instead of a heuristic.",
};
