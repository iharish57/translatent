"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ConfiguredProvider } from "@/lib/auth-providers";

const PROVIDER_META: Record<
  ConfiguredProvider["id"],
  { label: string; icon: React.ReactNode }
> = {
  google: {
    label: "Continue with Google",
    icon: (
      <svg viewBox="0 0 24 24" className="size-4">
        <path
          fill="#4285F4"
          d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
        />
        <path
          fill="#34A853"
          d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.99.66-2.25 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z"
        />
        <path
          fill="#FBBC05"
          d="M5.84 14.09A6.6 6.6 0 0 1 5.5 12c0-.73.13-1.43.34-2.09V7.07H2.18A11 11 0 0 0 1 12c0 1.77.43 3.45 1.18 4.93z"
        />
        <path
          fill="#EA4335"
          d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1a11 11 0 0 0-9.82 6.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        />
      </svg>
    ),
  },
  "microsoft-entra-id": {
    label: "Continue with Microsoft",
    icon: (
      <svg viewBox="0 0 24 24" className="size-4">
        <path fill="#F25022" d="M2 2h9.5v9.5H2z" />
        <path fill="#7FBA00" d="M12.5 2H22v9.5h-9.5z" />
        <path fill="#00A4EF" d="M2 12.5h9.5V22H2z" />
        <path fill="#FFB900" d="M12.5 12.5H22V22h-9.5z" />
      </svg>
    ),
  },
  apple: {
    label: "Continue with Apple",
    icon: (
      <svg viewBox="0 0 24 24" className="size-4" fill="currentColor">
        <path d="M16.365 1.43c0 1.14-.462 2.19-1.215 2.97-.83.87-2.14 1.53-3.223 1.44-.132-1.09.437-2.24 1.198-3 .83-.87 2.28-1.51 3.24-1.41zM20.79 17.25c-.51 1.18-.75 1.71-1.4 2.75-.91 1.45-2.19 3.25-3.78 3.27-1.41.02-1.77-.92-3.68-.91-1.91.01-2.31.93-3.72.91-1.59-.02-2.8-1.65-3.71-3.1-2.55-4.03-2.82-8.76-1.25-11.28.11.19-.02.03.99-.5.9-.47 1.94-.73 2.97-.75 1.55-.03 3.02.98 3.97.98.94 0 2.72-1.22 4.58-1.04.78.03 2.97.32 4.38 2.4-.11.07-2.61 1.53-2.58 4.56.03 3.61 3.17 4.81 3.2 4.83z" />
      </svg>
    ),
  },
};

export function SignInButtons({
  providers,
  callbackUrl,
}: {
  providers: ConfiguredProvider[];
  callbackUrl: string;
}) {
  const [pending, setPending] = useState<string | null>(null);

  async function handleSignIn(providerId: string) {
    setPending(providerId);
    try {
      await signIn(providerId, { callbackUrl });
    } finally {
      // If signIn redirects (the normal case) this won't run before
      // navigation, but it prevents a stuck spinner on failure.
      setPending(null);
    }
  }

  if (providers.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-secondary p-4 text-sm text-muted-foreground">
        No sign-in providers are configured yet. Set Google, Microsoft, and/or Apple OAuth
        credentials in <code className="rounded bg-muted px-1 py-0.5">.env.local</code> — see the
        README for setup steps.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2.5">
      {providers.map((p) => {
        const meta = PROVIDER_META[p.id];
        const isPending = pending === p.id;
        return (
          <Button
            key={p.id}
            type="button"
            variant="outline"
            size="lg"
            disabled={pending !== null}
            onClick={() => handleSignIn(p.id)}
            className="h-11 w-full justify-center gap-3 bg-secondary text-sm font-semibold"
          >
            {isPending ? <Loader2 className="size-4 animate-spin" /> : meta.icon}
            {isPending ? "Redirecting..." : meta.label}
          </Button>
        );
      })}
    </div>
  );
}
