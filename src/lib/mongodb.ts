import mongoose from "mongoose";

const MONGODB_URI = process.env.MONGODB_URI;

// Cache the connection across hot-reloads in dev and across invocations in
// serverless environments, so we don't open a new connection per request.
declare global {
  // eslint-disable-next-line no-var
  var _mongooseConnPromise: Promise<typeof mongoose> | undefined;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Atlas `mongodb+srv://` URIs need SRV/TXT DNS lookups before the driver can
// even open a socket, and those lookups occasionally fail transiently — a
// single retry within the same request absorbs that instead of failing the
// whole login/save/history call outright.
async function connectWithRetry(uri: string, attempts = 3): Promise<typeof mongoose> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await mongoose.connect(uri, { bufferCommands: false });
    } catch (err) {
      lastErr = err;
      if (i < attempts - 1) await sleep(300 * 2 ** i);
    }
  }
  throw lastErr;
}

export async function connectToDatabase(): Promise<typeof mongoose> {
  if (!MONGODB_URI) {
    throw new Error(
      "MONGODB_URI is not set. Add it to .env.local — see README for how to get a " +
        "connection string from MongoDB Atlas (or point it at a local MongoDB instance)."
    );
  }

  if (!global._mongooseConnPromise) {
    global._mongooseConnPromise = connectWithRetry(MONGODB_URI).catch((err) => {
      // A rejected promise is a settled value — if we left it cached, every
      // later call would just re-await this same rejection forever, so one
      // transient DNS/network hiccup (Atlas SRV lookups are prone to these)
      // would permanently break login and history saving until the process
      // restarts. Clear the cache on failure so the next call retries fresh.
      global._mongooseConnPromise = undefined;
      throw err;
    });
  }

  return global._mongooseConnPromise;
}
