import Anthropic from "@anthropic-ai/sdk";
import type { TranslationResult } from "../types";

const DEFAULT_MODEL = "claude-sonnet-5";

const CLAUDE_SYSTEM_PROMPT = `You are a professional Arabic-to-English translator \
specializing in government documents, official correspondence, and general \
text. Translate the provided Arabic text into clear, accurate English.

Preserve the source document's structure exactly in your translation:
- Keep the same paragraph breaks (blank lines between paragraphs).
- Keep the same line breaks within a paragraph if the source has them.
- If the source uses bullet points, dashes, numbered lists, or lettered \
lists, keep the same list structure and markers (translate numbering \
style naturally, e.g. Arabic-indic numerals to Arabic numerals) with one \
item per line.
- Preserve headings, titles, and any tabular/columnar layout as separate \
lines rather than merging everything into one paragraph.
- Do not add structure that isn't in the source, and do not collapse \
distinct lines/items into a single run-on paragraph.

Respond ONLY with a single JSON object, no markdown fences, no extra text, \
with exactly these fields:
{
  "translation": "<the full English translation, using \\n for line breaks \
and \\n\\n between paragraphs, mirroring the source structure>",
  "confidence": <integer 0-100, your honest self-assessed confidence that \
the translation is accurate and complete>,
  "document_type_guess": "<short guess, e.g. 'government ID', 'letter', \
'certificate', 'form', 'general text'>",
  "ambiguous_terms": ["<term or phrase 1>", "<term or phrase 2>", ...],
  "notes": "<1-2 sentences on anything a human reviewer should double-check, \
or empty string if none>"
}

If the input text looks garbled or incomplete (e.g. due to OCR errors), \
lower your confidence accordingly and mention it in notes.`;

const CLAUDE_VISION_SYSTEM_PROMPT = `You are an expert Arabic document transcriber \
and translator, specializing in reading text that conventional OCR software \
fails on: messy or cursive handwriting, faint photocopies, skewed or \
low-resolution photos, and degraded government forms. You translate the \
transcribed Arabic into clear, accurate English.

This is your single highest-value skill: extracting text from documents that \
look, at first glance, illegible. Do not give up or under-transcribe just \
because handwriting is poor — work at it the way an expert forensic \
document examiner would:
- Examine the image region by region rather than skimming it as a whole; \
treat faint, small, or crowded handwriting as worth the same close reading \
as clear print.
- Use letter shape, word length, connecting strokes, and Arabic \
orthographic rules (which letters can/cannot connect, dot placement, \
diacritics) to disambiguate messy strokes, the same way a native reader \
would puzzle out bad handwriting.
- Use document context aggressively: field labels on forms (e.g. name, \
date of birth, national ID, address) tell you what *kind* of value should \
follow, which narrows down illegible handwritten values a lot. Common \
Arabic given names, place names, and bureaucratic phrasing are strong \
priors — use them.
- If part of a word is clear and part is smudged, transcribe the clear \
part and make your best-supported inference for the rest rather than \
discarding the whole word.
- Never fabricate content that has no visual basis in the image. Only mark \
a span as [illegible] when, after this level of effort, no defensible \
reading exists — use it sparingly, for genuinely unrecoverable strokes, \
not as a default for anything difficult.

Look carefully at the provided image and:
1. Transcribe all Arabic text exactly as written, applying the above \
approach to every handwritten, faint, or low-quality region.
2. Preserve the document's structure in your transcription: keep the same \
paragraph breaks, line breaks, bullet points/numbered lists (with their \
markers), and headings as separate lines — don't merge everything into \
one run-on paragraph. If the document is a form, keep each label/value pair \
on its own line in the same order they appear.
3. Translate the transcribed text into English, mirroring that same \
structure (paragraph breaks, bullets, numbering, headings, label/value \
lines).

Respond ONLY with a single JSON object, no markdown fences, no extra text, \
with exactly these fields:
{
  "source_text": "<the transcribed Arabic text, using \\n for line breaks \
and \\n\\n between paragraphs, preserving bullets/numbering markers>",
  "translation": "<the English translation, using \\n / \\n\\n the same way, \
mirroring source_text's structure>",
  "confidence": <integer 0-100, your honest combined confidence in both the \
transcription and the translation>,
  "document_type_guess": "<short guess, e.g. 'government ID', 'handwritten \
letter', 'certificate', 'form', 'general text'>",
  "ambiguous_terms": ["<word/phrase/name you were not fully sure of>", ...],
  "notes": "<1-2 sentences flagging illegible sections, guesses made, poor \
image quality, or anything a human reviewer should double-check; empty \
string if none>"
}`;

function parseClaudeJson(resp: Anthropic.Message): Record<string, unknown> {
  let raw = resp.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();

  raw = raw.replace(/^```(json)?/, "").replace(/```$/, "").trim();

  try {
    return JSON.parse(raw);
  } catch {
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("Could not parse a JSON response from Claude.");
    return JSON.parse(match[0]);
  }
}

export async function translateClaude(
  arabicText: string,
  apiKey: string,
  model: string = DEFAULT_MODEL
): Promise<TranslationResult> {
  const client = new Anthropic({ apiKey });
  const resp = await client.messages.create({
    model,
    max_tokens: 8192,
    system: CLAUDE_SYSTEM_PROMPT,
    messages: [{ role: "user", content: arabicText }],
  });

  const parsed = parseClaudeJson(resp);
  return {
    translation: (parsed.translation as string) || "",
    modelConfidence: typeof parsed.confidence === "number" ? parsed.confidence : null,
    documentTypeGuess: (parsed.document_type_guess as string) || "",
    ambiguousTerms: (parsed.ambiguous_terms as string[]) || [],
    notes: (parsed.notes as string) || "",
  };
}

interface VisionPageResult {
  sourceText: string;
  translation: string;
  confidence: number | null;
  documentTypeGuess: string;
  ambiguousTerms: string[];
  notes: string;
}

// Page images are preprocessed (upscaled, contrast-stretched) to PNG before
// they ever reach this module — see src/lib/image-preprocess.ts.
export type ImageMediaType = "image/png" | "image/jpeg" | "image/webp" | "image/gif";

function visionResultFromParsed(
  parsed: Record<string, unknown>,
  stopReason: Anthropic.Message["stop_reason"]
): VisionPageResult {
  const notes = (parsed.notes as string) || "";
  return {
    sourceText: ((parsed.source_text as string) || "").trim(),
    translation: ((parsed.translation as string) || "").trim(),
    confidence: typeof parsed.confidence === "number" ? parsed.confidence : null,
    documentTypeGuess: (parsed.document_type_guess as string) || "",
    ambiguousTerms: (parsed.ambiguous_terms as string[]) || [],
    notes:
      stopReason === "max_tokens"
        ? `${notes} (Response was cut off before finishing — the page may be unusually dense; consider splitting it.)`.trim()
        : notes,
  };
}

async function translateClaudeVisionPage(
  imageBuffer: Buffer,
  apiKey: string,
  model: string,
  mediaType: ImageMediaType = "image/png"
): Promise<VisionPageResult> {
  const client = new Anthropic({ apiKey });
  const b64 = imageBuffer.toString("base64");

  const resp = await client.messages.create({
    model,
    // Dense/handwritten pages need room for a full transcription *and* its
    // translation in one JSON payload; 4096 could silently truncate that.
    max_tokens: 8192,
    // Transcription is a reading task, not a creative one — pin it down so
    // the model commits to its single best reading of each stroke instead
    // of sampling a slightly different (and less careful) guess each run.
    temperature: 0,
    system: CLAUDE_VISION_SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: { type: "base64", media_type: mediaType, data: b64 },
          },
          {
            type: "text",
            text: "Transcribe and translate the Arabic text in this image, following the JSON format specified in the system prompt. Take your time with any handwritten, faint, or low-quality sections rather than skimming past them.",
          },
        ],
      },
    ],
  });

  return visionResultFromParsed(parseClaudeJson(resp), resp.stop_reason);
}

/** A first pass can under-read a hard page even at temperature 0 — it only
 * gets one look. When the first pass itself flags trouble (low confidence,
 * hedged/ambiguous terms, or notes about illegible spans), send the image
 * back with its own draft attached and have it specifically re-scrutinize
 * the parts it was unsure about, the way a human proofreader checks a first
 * draft against the source rather than re-reading cold. */
function needsRefinementPass(page: VisionPageResult): boolean {
  if (page.confidence !== null && page.confidence < 85) return true;
  if (page.ambiguousTerms.length > 0) return true;
  if (/illegible|unclear|unsure|uncertain|hard to read|difficult to read/i.test(page.notes)) {
    return true;
  }
  return false;
}

async function refineClaudeVisionPage(
  imageBuffer: Buffer,
  draft: VisionPageResult,
  apiKey: string,
  model: string,
  mediaType: ImageMediaType
): Promise<VisionPageResult> {
  const client = new Anthropic({ apiKey });
  const b64 = imageBuffer.toString("base64");

  const resp = await client.messages.create({
    model,
    max_tokens: 8192,
    temperature: 0,
    system: CLAUDE_VISION_SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: { type: "base64", media_type: mediaType, data: b64 },
          },
          {
            type: "text",
            text: `A first pass at transcribing this image flagged some parts as uncertain. Look at the image again, one more time, and focus especially hard on the flagged spans — zoom in mentally on those strokes, weigh alternate readings, and use surrounding context to settle on the best-supported answer. Correct any mistakes you find anywhere in the draft, not only the flagged parts; keep anything that was already right.

Draft transcription:
"""
${draft.sourceText || "(empty — the first pass found no legible text)"}
"""

Flagged as ambiguous: ${draft.ambiguousTerms.length ? draft.ambiguousTerms.join(", ") : "(none listed)"}
First-pass notes: ${draft.notes || "(none)"}

Respond with the same JSON format specified in the system prompt, containing your corrected, final transcription and translation.`,
          },
        ],
      },
    ],
  });

  return visionResultFromParsed(parseClaudeJson(resp), resp.stop_reason);
}

async function transcribeVisionPageWithRefinement(
  imageBuffer: Buffer,
  apiKey: string,
  model: string,
  mediaType: ImageMediaType
): Promise<VisionPageResult> {
  const draft = await translateClaudeVisionPage(imageBuffer, apiKey, model, mediaType);
  if (!needsRefinementPass(draft)) return draft;
  return refineClaudeVisionPage(imageBuffer, draft, apiKey, model, mediaType);
}

export interface VisionResult {
  sourceText: string;
  translation: TranslationResult;
}

/** Run the vision pipeline over one or more page images and merge the
 * per-page results into a single extraction + translation result. */
export async function translateClaudeVision(
  images: Buffer[],
  apiKey: string,
  model: string = DEFAULT_MODEL,
  mediaType: ImageMediaType = "image/png"
): Promise<VisionResult> {
  const sourceTexts: string[] = [];
  const translations: string[] = [];
  const confidences: number[] = [];
  const ambiguousTerms: string[] = [];
  const notesList: string[] = [];
  let docType = "";

  for (const img of images) {
    const page = await transcribeVisionPageWithRefinement(img, apiKey, model, mediaType);
    if (page.sourceText) sourceTexts.push(page.sourceText);
    if (page.translation) translations.push(page.translation);
    if (page.confidence !== null) confidences.push(page.confidence);
    ambiguousTerms.push(...page.ambiguousTerms);
    if (page.notes) notesList.push(page.notes);
    if (!docType) docType = page.documentTypeGuess;
  }

  const avgConfidence = confidences.length
    ? confidences.reduce((a, b) => a + b, 0) / confidences.length
    : null;

  return {
    sourceText: sourceTexts.join("\n\n").trim(),
    translation: {
      translation: translations.join("\n\n").trim(),
      modelConfidence: avgConfidence !== null ? Math.round(avgConfidence * 10) / 10 : null,
      documentTypeGuess: docType,
      ambiguousTerms,
      notes: notesList.join(" "),
    },
  };
}
