import { translateStructured } from "../chunk";
import type { TranslationResult } from "../types";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Free, no-API-key Google Translate via the public web endpoint (the same
 * unofficial endpoint libraries like deep-translator / googletrans use).
 * Can occasionally be rate-limited or change without notice. Longer
 * documents make one request per chunk in sequence, which can trip this
 * endpoint's rate limiting partway through — so a 429/503 gets a couple of
 * short backed-off retries before we give up and surface an error. */
async function rawGoogleTranslate(text: string, attempt = 0): Promise<string> {
  const url =
    "https://translate.googleapis.com/translate_a/single" +
    "?client=gtx&sl=ar&tl=en&dt=t&q=" +
    encodeURIComponent(text);

  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; ArabicTranslator/1.0)" },
  });
  if (!res.ok) {
    const isRetryable = res.status === 429 || res.status >= 500;
    if (isRetryable && attempt < 2) {
      await sleep(500 * 2 ** attempt);
      return rawGoogleTranslate(text, attempt + 1);
    }
    throw new Error(
      `Google Translate (free) request failed: HTTP ${res.status}. This free endpoint ` +
        "can be rate-limited or temporarily unavailable — try again, use a smaller " +
        "document, or switch backends."
    );
  }
  const data = (await res.json()) as unknown[];
  // Response shape: [[[translatedChunk, originalChunk, ...], ...], ...]
  const segments = (data[0] as unknown[][]) || [];
  return segments.map((seg) => (seg[0] as string) || "").join("");
}

export async function translateGoogleFree(arabicText: string): Promise<TranslationResult> {
  const { text } = await translateStructured(
    arabicText,
    async (chunk) => ({ text: await rawGoogleTranslate(chunk), score: null }),
    4500
  );

  return {
    translation: text,
    modelConfidence: null,
    documentTypeGuess: "",
    ambiguousTerms: [],
    notes:
      "Free Google Translate backend. No model self-confidence available; accuracy " +
      "score below is a heuristic based on OCR/text quality only.",
  };
}
