import type { Backend, Extraction, Metrics, TranslationResult } from "./types";

/** Rough heuristic: fraction of alphabetic characters that are Arabic script. */
export function arabicRatio(text: string): number {
  if (!text) return 0;
  const letters = [...text].filter((c) => /\p{L}/u.test(c));
  if (letters.length === 0) return 0;
  const arabic = letters.filter((c) => c >= "؀" && c <= "ۿ").length;
  return arabic / letters.length;
}

export function computeMetrics(
  extraction: Extraction,
  translation: TranslationResult,
  backend: Backend
): Metrics {
  const text = extraction.text || "";
  const wordCount = text.split(/\s+/).filter(Boolean).length;
  const charCount = text.length;
  const ocrConfidence = extraction.ocrConfidence;
  const modelConfidence = translation.modelConfidence;

  const arRatio = arabicRatio(text);
  let qualityPenalty = 0;
  if (wordCount < 3) qualityPenalty += 30;
  if (arRatio < 0.3 && wordCount > 0) qualityPenalty += 20;

  let score: number;
  if ((backend === "claude" || backend === "mymemory") && modelConfidence !== null) {
    score = ocrConfidence !== null ? 0.7 * modelConfidence + 0.3 * ocrConfidence : modelConfidence;
  } else {
    score = ocrConfidence !== null ? ocrConfidence : 75; // native pdf / typed text assumed clean
  }

  score = Math.max(0, Math.min(100, score - qualityPenalty));

  const label = score >= 85 ? "High" : score >= 65 ? "Medium" : "Low";

  return {
    accuracyScore: Math.round(score * 10) / 10,
    accuracyLabel: label,
    ocrConfidence: ocrConfidence !== null ? Math.round(ocrConfidence * 10) / 10 : null,
    modelConfidence,
    extractionSource: extraction.source,
    wordCount,
    charCount,
    arabicCharRatio: Math.round(arRatio * 100) / 100,
  };
}
