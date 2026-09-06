"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const MIN_PASSWORD_LENGTH = 8;

export function EmailAuthForm({ callbackUrl }: { callbackUrl: string }) {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password) {
      setError("Enter your email and password.");
      return;
    }
    if (mode === "signup" && password.length < MIN_PASSWORD_LENGTH) {
      setError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }

    setPending(true);
    try {
      if (mode === "signup") {
        const res = await fetch("/api/signup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: trimmedEmail, password, name: name.trim() }),
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error || "Could not create account.");
          setPending(false);
          return;
        }
      }

      const result = await signIn("credentials", {
        email: trimmedEmail,
        password,
        redirect: false,
      });
      if (!result || result.error) {
        setError(
          mode === "signup"
            ? "Account created, but signing in failed — try signing in below."
            : "Incorrect email or password."
        );
        setPending(false);
        return;
      }
      // Full navigation so the server picks up the freshly-set session cookie.
      window.location.assign(callbackUrl);
    } catch {
      setError("Something went wrong. Please try again.");
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <form onSubmit={handleSubmit} className="flex flex-col gap-2.5">
        {mode === "signup" && (
          <Input
            type="text"
            placeholder="Name (optional)"
            autoComplete="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={pending}
          />
        )}
        <Input
          type="email"
          placeholder="Email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={pending}
          required
        />
        <Input
          type="password"
          placeholder={mode === "signup" ? `Password (min ${MIN_PASSWORD_LENGTH} characters)` : "Password"}
          autoComplete={mode === "signup" ? "new-password" : "current-password"}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={pending}
          required
        />

        {error && <p className="text-sm text-destructive">{error}</p>}

        <Button type="submit" size="lg" disabled={pending} className="h-11 w-full justify-center gap-2 text-sm font-semibold">
          {pending && <Loader2 className="size-4 animate-spin" />}
          {pending ? "Please wait..." : mode === "signup" ? "Create account" : "Sign in"}
        </Button>
      </form>

      <button
        type="button"
        onClick={() => {
          setMode((m) => (m === "login" ? "signup" : "login"));
          setError(null);
        }}
        className="text-center text-sm text-muted-foreground hover:text-foreground"
      >
        {mode === "login" ? "Don't have an account? Sign up" : "Already have an account? Sign in"}
      </button>
    </div>
  );
}
