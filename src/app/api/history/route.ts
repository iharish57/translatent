import { NextRequest, NextResponse } from "next/server";
import { auth } from "../../../../auth";
import { connectToDatabase } from "@/lib/mongodb";
import { TranslationHistory } from "@/lib/models/translation-history";
import type { TranslateApiResponse } from "@/lib/types";

export const runtime = "nodejs";

const HISTORY_LIMIT = 200;

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  try {
    await connectToDatabase();
    const docs = await TranslationHistory.find({ userId: session.user.id })
      .sort({ createdAt: -1 })
      .limit(HISTORY_LIMIT)
      .lean();

    const items: TranslateApiResponse[] = docs.map((doc) => ({
      historyId: doc._id.toString(),
      createdAt: (doc.createdAt as Date).toISOString(),
      sourceText: doc.sourceText,
      translation: doc.translation,
      documentTypeGuess: doc.documentTypeGuess || "",
      ambiguousTerms: doc.ambiguousTerms || [],
      notes: doc.notes || "",
      metrics: {
        accuracyScore: doc.metrics.accuracyScore ?? 0,
        accuracyLabel: (doc.metrics.accuracyLabel as "High" | "Medium" | "Low") ?? "Low",
        ocrConfidence: doc.metrics.ocrConfidence ?? null,
        modelConfidence: doc.metrics.modelConfidence ?? null,
        extractionSource: doc.metrics.extractionSource as TranslateApiResponse["metrics"]["extractionSource"],
        wordCount: doc.metrics.wordCount ?? 0,
        charCount: doc.metrics.charCount ?? 0,
        arabicCharRatio: doc.metrics.arabicCharRatio ?? 0,
      },
      backend: doc.backend as TranslateApiResponse["backend"],
      inputKind: doc.inputKind as TranslateApiResponse["inputKind"],
      fileName: doc.fileName ?? null,
      processingTimeSec: doc.processingTimeSec ?? 0,
    }));

    return NextResponse.json({ items });
  } catch (err) {
    console.error(err);
    const message = err instanceof Error ? err.message : "Could not load history.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const id = req.nextUrl.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "Missing id." }, { status: 400 });
  }

  try {
    await connectToDatabase();
    const result = await TranslationHistory.deleteOne({ _id: id, userId: session.user.id });
    if (result.deletedCount === 0) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(err);
    const message = err instanceof Error ? err.message : "Could not delete history entry.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
