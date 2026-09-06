import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id";
import Apple from "next-auth/providers/apple";
import Credentials from "next-auth/providers/credentials";
import { getOrCreateUser } from "@/lib/get-or-create-user";
import { connectToDatabase } from "@/lib/mongodb";
import { User } from "@/lib/models/user";
import { verifyPassword } from "@/lib/password";

const providers = [];

if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  providers.push(
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      // Without this, Google silently re-signs the user into whichever
      // account is already active in the browser instead of showing the
      // account chooser — making it impossible to pick a different account
      // at sign-in without first signing out of Google itself.
      authorization: { params: { prompt: "select_account" } },
    })
  );
}

if (process.env.AZURE_AD_CLIENT_ID && process.env.AZURE_AD_CLIENT_SECRET) {
  providers.push(
    MicrosoftEntraID({
      clientId: process.env.AZURE_AD_CLIENT_ID,
      clientSecret: process.env.AZURE_AD_CLIENT_SECRET,
      issuer: process.env.AZURE_AD_TENANT_ID
        ? `https://login.microsoftonline.com/${process.env.AZURE_AD_TENANT_ID}/v2.0`
        : undefined, // falls back to the multi-tenant "common" endpoint
      // Same account-chooser reasoning as the Google provider above.
      authorization: { params: { prompt: "select_account" } },
    })
  );
}

if (process.env.APPLE_CLIENT_ID && process.env.APPLE_CLIENT_SECRET) {
  providers.push(
    Apple({
      clientId: process.env.APPLE_CLIENT_ID,
      clientSecret: process.env.APPLE_CLIENT_SECRET,
    })
  );
}

// No external service to configure for this one — email/password accounts
// are stored in our own Mongo `users` collection (see /api/signup), so it's
// always available.
providers.push(
  Credentials({
    id: "credentials",
    name: "Email",
    credentials: {
      email: { label: "Email", type: "email" },
      password: { label: "Password", type: "password" },
    },
    async authorize(credentials) {
      const email = typeof credentials?.email === "string" ? credentials.email.trim().toLowerCase() : "";
      const password = typeof credentials?.password === "string" ? credentials.password : "";
      if (!email || !password) return null;

      await connectToDatabase();
      const user = await User.findOne({ email }).select("+passwordHash");
      // Same generic failure for "no such account" and "wrong password" —
      // and for an account that was created via SSO and has no password at
      // all — so a login attempt can't be used to probe which emails exist.
      if (!user?.passwordHash) return null;
      const valid = await verifyPassword(password, user.passwordHash);
      if (!valid) return null;

      return {
        id: user._id.toString(),
        email: user.email,
        name: user.name ?? null,
        image: user.image ?? null,
      };
    },
  })
);

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers,
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  callbacks: {
    async jwt({ token, account, profile, user }) {
      // `profile` only exists for OAuth sign-ins — the Credentials provider
      // hands back `user` (whatever authorize() returned) instead, with no
      // profile object at all.
      if (account) {
        token.provider = account.provider;
      }

      // Runs on initial sign-in (account/profile/user present) *and* on
      // every later request that reads the session, as long as userId is
      // still missing. A transient Mongo hiccup at login time used to leave
      // the whole session permanently without a userId — history would
      // silently stop saving until the next full logout/login. Retrying
      // here means a brief outage self-heals on the very next page load
      // instead.
      const email = profile?.email ?? user?.email ?? token.email;
      if (!token.userId && email) {
        try {
          token.userId = await getOrCreateUser({
            email,
            name: (profile?.name as string | undefined) ?? (user?.name as string | undefined) ?? token.name,
            image:
              (profile?.picture as string | undefined) ??
              (profile?.image as string | undefined) ??
              (user?.image as string | undefined) ??
              token.picture,
            provider: (account?.provider as string | undefined) ?? (token.provider as string | undefined),
          });
        } catch (err) {
          // Don't hard-fail sign-in/session refresh if Mongo is briefly
          // unavailable — the session still works, just without a
          // persisted user id until a later request retries successfully.
          console.error("Failed to upsert user in MongoDB:", err);
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = (token.userId as string | undefined) ?? "";
        (session.user as { provider?: string }).provider = token.provider as string | undefined;
      }
      return session;
    },
  },
});
