import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";

const metricsSchema = new Schema(
  {
    accuracyScore: Number,
    accuracyLabel: String,
    ocrConfidence: Number,
    modelConfidence: Number,
    extractionSource: String,
    wordCount: Number,
    charCount: Number,
    arabicCharRatio: Number,
  },
  { _id: false }
);

const translationHistorySchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    backend: { type: String, required: true },
    inputKind: { type: String, enum: ["file", "text"], required: true },
    fileName: { type: String, default: null },
    sourceText: { type: String, required: true },
    translation: { type: String, required: true },
    documentTypeGuess: { type: String, default: "" },
    ambiguousTerms: { type: [String], default: [] },
    notes: { type: String, default: "" },
    metrics: { type: metricsSchema, required: true },
    processingTimeSec: { type: Number, default: 0 },
  },
  { timestamps: true }
);

translationHistorySchema.index({ userId: 1, createdAt: -1 });

export type TranslationHistoryDoc = InferSchemaType<typeof translationHistorySchema>;

export const TranslationHistory: Model<TranslationHistoryDoc> =
  models.TranslationHistory ||
  model<TranslationHistoryDoc>("TranslationHistory", translationHistorySchema);
