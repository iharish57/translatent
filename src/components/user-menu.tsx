"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signOut, signIn } from "next-auth/react";
import { LogOut, Loader2, UserRoundCog } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export interface SessionUser {
  name?: string | null;
  email?: string | null;
  image?: string | null;
  provider?: string | null;
}

function initials(user: SessionUser): string {
  const source = user.name || user.email || "?";
  const parts = source.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return source.slice(0, 2).toUpperCase();
}

export function UserMenu({ user }: { user: SessionUser }) {
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);
  const [switchingAccount, setSwitchingAccount] = useState(false);
  const busy = signingOut || switchingAccount;

  async function handleSignOut() {
    setSigningOut(true);
    await signOut({ callbackUrl: "/login" });
  }

  async function handleSwitchAccount() {
    setSwitchingAccount(true);
    // Sign out of this app's session, then jump straight back into the
    // same provider's sign-in flow — the account-chooser prompt configured
    // on the provider means this lands on "pick an account" instead of
    // silently re-authenticating as whoever was just signed out. Email/
    // password accounts have no such prompt to jump back into (and no
    // fields to silently resubmit), so just send those to the login form.
    await signOut({ redirect: false });
    if (user.provider && user.provider !== "credentials") {
      await signIn(user.provider, { callbackUrl: "/" });
    } else {
      router.push("/login");
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="rounded-full outline-none ring-offset-2 ring-offset-background transition-shadow focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="Account menu"
        >
          <Avatar>
            <AvatarImage src={user.image ?? undefined} alt={user.name ?? user.email ?? "Account"} />
            <AvatarFallback>{initials(user)}</AvatarFallback>
          </Avatar>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuLabel>
          <div className="flex flex-col">
            <span className="truncate text-sm font-medium">{user.name || "Signed in"}</span>
            {user.email && <span className="truncate text-xs text-muted-foreground">{user.email}</span>}
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled={busy} onSelect={handleSwitchAccount}>
          {switchingAccount ? <Loader2 className="animate-spin" /> : <UserRoundCog />}
          {switchingAccount ? "Switching..." : "Switch account"}
        </DropdownMenuItem>
        <DropdownMenuItem variant="destructive" disabled={busy} onSelect={handleSignOut}>
          {signingOut ? <Loader2 className="animate-spin" /> : <LogOut />}
          {signingOut ? "Signing out..." : "Sign out"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
