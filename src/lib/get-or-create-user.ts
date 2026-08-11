import { connectToDatabase } from "./mongodb";
import { User } from "./models/user";

export interface SsoProfile {
  email: string;
  name?: string | null;
  image?: string | null;
  provider?: string;
}

/** Upsert the app-level User document for a signed-in SSO account, keyed by
 * email. Returns the Mongo _id as a string, used as the stable user id
 * embedded in the session JWT. */
export async function getOrCreateUser(profile: SsoProfile): Promise<string> {
  await connectToDatabase();

  const doc = await User.findOneAndUpdate(
    { email: profile.email },
    {
      $set: {
        name: profile.name || undefined,
        image: profile.image || undefined,
        provider: profile.provider || undefined,
        lastLoginAt: new Date(),
      },
      $setOnInsert: { email: profile.email },
    },
    { upsert: true, new: true }
  );

  return doc._id.toString();
}
