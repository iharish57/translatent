import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id";
import Apple from "next-auth/providers/apple";
import { getOrCreateUser } from "@/lib/get-or-create-user";

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

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers,
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  callbacks: {
    async jwt({ token, account, profile }) {
      if (account && profile?.email) {
        token.provider = account.provider;
      }

      // Runs on initial sign-in (account/profile present) *and* on every
      // later request that reads the session, as long as userId is still
      // missing. A transient Mongo hiccup at login time used to leave the
      // whole session permanently without a userId — history would silently
      // stop saving until the next full logout/login. Retrying here means a
      // brief outage self-heals on the very next page load instead.
      const email = profile?.email ?? token.email;
      if (!token.userId && email) {
        try {
          token.userId = await getOrCreateUser({
            email,
            name: (profile?.name as string | undefined) ?? token.name,
            image:
              (profile?.picture as string | undefined) ??
              (profile?.image as string | undefined) ??
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
