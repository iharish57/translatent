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
      // Only runs on initial sign-in (when `account`/`profile` are present),
      // not on every request — so this DB write happens once per login, not
      // once per page view.
      if (account && profile?.email) {
        try {
          const userId = await getOrCreateUser({
            email: profile.email,
            name: profile.name as string | undefined,
            image: (profile.picture as string | undefined) ?? (profile.image as string | undefined),
            provider: account.provider,
          });
          token.userId = userId;
        } catch (err) {
          // Don't hard-fail sign-in if Mongo is briefly unavailable — the
          // session still works, just without a persisted user id (history
          // saves will fail gracefully and surface a toast instead).
          console.error("Failed to upsert user in MongoDB:", err);
        }
        token.provider = account.provider;
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
