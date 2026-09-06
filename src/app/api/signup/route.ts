import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { User } from "@/lib/models/user";
import { hashPassword } from "@/lib/password";

export const runtime = "nodejs";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 8;

export async function POST(req: NextRequest) {
  let body: { email?: string; password?: string; name?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Could not read the request body." }, { status: 400 });
  }

  const email = (body.email || "").trim().toLowerCase();
  const password = body.password || "";
  const name = (body.name || "").trim();

  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    return NextResponse.json(
      { error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.` },
      { status: 400 }
    );
  }

  try {
    await connectToDatabase();

    const existing = await User.findOne({ email });
    if (existing) {
      return NextResponse.json(
        { error: "An account with this email already exists. Try signing in instead." },
        { status: 409 }
      );
    }

    const passwordHash = await hashPassword(password);
    await User.create({
      email,
      name: name || undefined,
      passwordHash,
      provider: "credentials",
      lastLoginAt: new Date(),
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Signup failed:", err);
    const message = err instanceof Error ? err.message : "Could not create account.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
