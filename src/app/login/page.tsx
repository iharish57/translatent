import { Languages, AlertCircle } from "lucide-react";
import { getConfiguredProviders } from "@/lib/auth-providers";
import { SignInButtons } from "@/components/sign-in-buttons";

const ERROR_MESSAGES: Record<string, string> = {
  OAuthSignin: "Couldn't start the sign-in flow. Please try again.",
  OAuthCallback: "Sign-in didn't complete. Please try again.",
  OAuthAccountNotLinked: "This email is already linked to a different sign-in method.",
  AccessDenied: "Access was denied.",
  Configuration: "Sign-in isn't configured correctly. Check the server's environment variables.",
  Default: "Something went wrong signing you in. Please try again.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; callbackUrl?: string }>;
}) {
  const params = await searchParams;
  const providers = getConfiguredProviders();
  const callbackUrl = params.callbackUrl || "/";
  const errorMessage = params.error ? ERROR_MESSAGES[params.error] || ERROR_MESSAGES.Default : null;

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-4 flex size-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
            <Languages className="size-6" />
          </div>
          <h1 className="text-xl font-semibold">Arabic → English Translator</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Sign in to translate documents and keep your history.
          </p>
        </div>

        {errorMessage && (
          <div className="mb-4 flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        <SignInButtons providers={providers} callbackUrl={callbackUrl} />

        <p className="mt-6 text-center text-xs text-muted-foreground">
          By continuing, you agree that translated documents are processed by third-party
          translation APIs (Anthropic, Google, or MyMemory) depending on the engine you choose.
        </p>
      </div>
    </div>
  );
}
