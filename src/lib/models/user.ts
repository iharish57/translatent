import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";

const userSchema = new Schema(
  {
    email: { type: String, required: true, unique: true, index: true },
    name: { type: String },
    image: { type: String },
    provider: { type: String }, // most recent sign-in method (google | microsoft-entra-id | apple | credentials)
    // Only set for accounts created via email/password signup. Excluded
    // from query results by default — opt in with .select("+passwordHash").
    passwordHash: { type: String, select: false },
    lastLoginAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

export type UserDoc = InferSchemaType<typeof userSchema>;

export const User: Model<UserDoc> = models.User || model<UserDoc>("User", userSchema);
