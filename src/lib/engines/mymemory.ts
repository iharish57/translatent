import { translateStructured } from "../chunk";
import type { TranslationResult } from "../types";

interface MyMemoryResponse {
  responseData?: { translatedText?: string; match?: number | string };
  matches?: { match?: number | string }[];
}

async function rawMyMemoryTranslate(text: string): Promise<{ text: string; score: number | null }> {
  const url =
    "https://api.mymemory.translated.net/get" +
    `?q=${encodeURIComponent(text)}&langpair=ar|en`;

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`MyMemory request failed: HTTP ${res.status}`);
  }
  const data = (await res.json()) as MyMemoryResponse;

  const translated = data.responseData?.translatedText || "";
  const scores: number[] = [];
  const match = data.responseData?.match;
  if (match !== undefined) {
    const n = Number(match);
    if (!Number.isNaN(n)) scores.push(n * 100);
  }
  for (const m of data.matches || []) {
    const n = Number(m.match);
    if (!Number.isNaN(n)) scores.push(n * 100);
  }
  const score = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : null;

  return { text: translated, score };
}

export async function translateMyMemory(arabicText: string): Promise<TranslationResult> {
  const { text, scores } = await translateStructured(arabicText, rawMyMemoryTranslate, 480);
  const avgMatch = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : null;

  return {
    translation: text,
    modelConfidence: avgMatch !== null ? Math.round(avgMatch * 10) / 10 : null,
    documentTypeGuess: "",
    ambiguousTerms: [],
    notes:
      'Free MyMemory backend. "Model confidence" here is MyMemory\'s own ' +
      "translation-memory match score, not a language-model self-assessment.",
  };
}
