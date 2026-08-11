import mongoose from "mongoose";

const MONGODB_URI = process.env.MONGODB_URI;

// Cache the connection across hot-reloads in dev and across invocations in
// serverless environments, so we don't open a new connection per request.
declare global {
  // eslint-disable-next-line no-var
  var _mongooseConnPromise: Promise<typeof mongoose> | undefined;
}

export async function connectToDatabase(): Promise<typeof mongoose> {
  if (!MONGODB_URI) {
    throw new Error(
      "MONGODB_URI is not set. Add it to .env.local — see README for how to get a " +
        "connection string from MongoDB Atlas (or point it at a local MongoDB instance)."
    );
  }

  if (!global._mongooseConnPromise) {
    global._mongooseConnPromise = mongoose.connect(MONGODB_URI, {
      bufferCommands: false,
    });
  }

  return global._mongooseConnPromise;
}
