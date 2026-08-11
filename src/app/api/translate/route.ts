import { NextRequest, NextResponse } from "next/server";
import { auth } from "../../../../auth";
import { extractText, runClaudePipeline, translateWithBackend } from "@/lib/pipeline";
import { translateClaude } from "@/lib/engines/claude";
import { computeMetrics } from "@/lib/metrics";
import { connectToDatabase } from "@/lib/mongodb";
import { TranslationHistory } from "@/lib/models/translation-history";
import type { Backend, Extraction, TranslateApiResponse, TranslationResult } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 300;

const ALLOWED_EXTENSIONS = new Set(["pdf", "png", "jpg", "jpeg", "tif", "tiff", "bmp", "webp"]);
const MAX_UPLOAD_BYTES = 25 * 1024 * 1024; // 25MB

function isBackend(value: string): value is Backend {
  return value === "claude" || value === "google_free" || value === "mymemory";
}

export async function POST(req: NextRequest) {
  const start = Date.now();

  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Could not read the request body." }, { status: 400 });
  }

  const file = formData.get("file");
  const typedTextRaw = formData.get("text");
  const backendRaw = (formData.get("backend") as string) || "claude";
  const apiKey = ((formData.get("api_key") as string) || "").trim();
  const model = ((formData.get("model") as string) || "claude-sonnet-5").trim() || "claude-sonnet-5";

  const typedText = typeof typedTextRaw === "string" ? typedTextRaw.trim() : "";
  const hasFile = file instanceof File && file.size > 0 && file.name !== "";

  if (!hasFile && !typedText) {
    return NextResponse.json({ error: "Type some Arabic text or attach a document." }, { status: 400 });
  }
  if (!isBackend(backendRaw)) {
    return NextResponse.json({ error: `Unknown backend '${backendRaw}'.` }, { status: 400 });
  }
  const backend = backendRaw;

  let ext = "";
  if (hasFile) {
    const f = file as File;
    ext = f.name.includes(".") ? f.name.split(".").pop()!.toLowerCase() : "";
    if (!ALLOWED_EXTENSIONS.has(ext)) {
      return NextResponse.json(
        { error: "Unsupported file type. Use PDF, PNG, JPG, TIFF, BMP, or WEBP." },
        { status: 400 }
      );
    }
    if (f.size > MAX_UPLOAD_BYTES) {
      return NextResponse.json({ error: "File is too large (max 25MB)." }, { status: 400 });
    }
  }
  if (backend === "claude" && !apiKey) {
    return NextResponse.json(
      { error: "An Anthropic API key is required for the Claude backend." },
      { status: 400 }
    );
  }

  try {
    let extraction: Extraction;
    let translation: TranslationResult;

    if (hasFile) {
      const buffer = Buffer.from(await (file as File).arrayBuffer());

      if (backend === "claude") {
        const result = await runClaudePipeline(buffer, ext, apiKey, model);
        extraction = result.extraction;
        translation = result.translation;
      } else {
        extraction = await extractText(buffer, ext);
        if (!extraction.text) {
          return NextResponse.json(
            {
              error:
                "No text could be extracted from this document. It may be blank, too " +
                "low-resolution, or not Arabic. If it's handwritten, try the Claude backend instead.",
            },
            { status: 422 }
          );
        }
        translation = await translateWithBackend(backend, extraction.text);
      }
    } else {
      extraction = { text: typedText, source: "typed_text", ocrConfidence: null };
      translation =
        backend === "claude"
          ? await translateClaude(typedText, apiKey, model)
          : await translateWithBackend(backend, typedText);
    }

    if (!extraction.text) {
      return NextResponse.json(
        {
          error:
            "No text could be extracted. The document may be blank, too low-resolution, " +
            "or illegible even for the vision pipeline.",
        },
        { status: 422 }
      );
    }

    const metrics = computeMetrics(extraction, translation, backend);
    const processingTimeSec = Math.round(((Date.now() - start) / 1000) * 100) / 100;

    let historyId: string | null = null;
    let createdAt = new Date().toISOString();

    if (session.user.id) {
      try {
        await connectToDatabase();
        const doc = await TranslationHistory.create({
          userId: session.user.id,
          backend,
          inputKind: hasFile ? "file" : "text",
          fileName: hasFile ? (file as File).name : null,
          sourceText: extraction.text,
          translation: translation.translation,
          documentTypeGuess: translation.documentTypeGuess,
          ambiguousTerms: translation.ambiguousTerms,
          notes: translation.notes,
          metrics,
          processingTimeSec,
        });
        historyId = doc._id.toString();
        createdAt = doc.createdAt?.toISOString() ?? createdAt;
      } catch (err) {
        // Translation still succeeded — just couldn't save to history.
        console.error("Failed to save translation history:", err);
      }
    }

    const body: TranslateApiResponse = {
      historyId,
      createdAt,
      sourceText: extraction.text,
      translation: translation.translation,
      documentTypeGuess: translation.documentTypeGuess,
      ambiguousTerms: translation.ambiguousTerms,
      notes: translation.notes,
      metrics,
      backend,
      inputKind: hasFile ? "file" : "text",
      fileName: hasFile ? (file as File).name : null,
      processingTimeSec,
    };

    return NextResponse.json(body);
  } catch (err) {
    console.error(err);
    const message = err instanceof Error ? err.message : "Something went wrong.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
