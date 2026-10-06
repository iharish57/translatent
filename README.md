# Translatent

An app for difficult arabic text recognition and language translation for heavy documents — saves time, makes them reachable and readable.

Type Arabic text directly, or upload a scanned document (PDF, PNG, JPG, TIFF, BMP, WEBP), and get a clean, structure-preserving English translation with an accuracy score, per-user history, and export to PDF/Word.

## Features

- **Text or document input** — type Arabic text, or attach a PDF/image (including scanned, low-quality, or handwritten government documents).
- **Three translation engines**, picked per translation:
  - **Claude** — best quality; handles handwriting, poor scans, and numbered legal/technical documents (e.g. clause numbers like `3.2.1`) via vision. Requires your own Anthropic API key, entered in the UI (never stored server-side).
  - **Google Translate (free)** — no key needed; usually the best free option, but an unofficial endpoint that can occasionally be rate-limited.
  - **MyMemory (free)** — no key needed; returns a genuine translation-memory match score instead of a heuristic.
- **Smart extraction pipeline** — native PDF text extraction where possible, Tesseract OCR for scanned images, and Claude's vision model as a fallback for handwriting or badly degraded scans.
- **Accuracy metrics** — a combined confidence score (OCR confidence, model confidence, Arabic character ratio, etc.) shown per translation.
- **Per-user history** — every translation is saved to your account, viewable, downloadable as PDF or Word (`.docx`), and deletable.
- **Retry** — a failed translation keeps its original text/file so you can retry it, optionally with a different engine.
- **Authentication** — sign in with Google, Microsoft, or Apple (each shown only if configured), or with email/password.

## Tech stack

- [Next.js 16](https://nextjs.org/) (App Router) + React 19 + TypeScript
- [Tailwind CSS 4](https://tailwindcss.com/) + [Radix UI](https://www.radix-ui.com/) primitives
- [MongoDB](https://www.mongodb.com/) via [Mongoose](https://mongoosejs.com/) — user accounts and translation history
- [Auth.js (NextAuth v5)](https://authjs.dev/) — Google / Microsoft Entra ID / Apple OAuth + email/password (credentials)
- [Anthropic SDK](https://github.com/anthropics/anthropic-sdk-typescript) — Claude translation and vision-based transcription
- [Tesseract.js](https://tesseract.projectnaptha.com/) — OCR for scanned images
- [pdfjs-dist](https://mozilla.github.io/pdf.js/) / [pdf-parse](https://www.npmjs.com/package/pdf-parse) — PDF text/page extraction
- [jsPDF](https://github.com/parallax/jsPDF) / [docx](https://www.npmjs.com/package/docx) — export translations to PDF/Word

## Prerequisites

- Node.js 20+
- A MongoDB connection string (a free [MongoDB Atlas](https://cloud.mongodb.com/) M0 cluster works fine)
- At least one way to sign in: an OAuth app (Google, Microsoft, or Apple) — or just use email/password, which needs no external setup

## Getting started

```bash
git clone git@github.com:iharish57/translatent.git
cd translatent
npm install
cp .env.local.example .env.local
```

Fill in `.env.local` (see [Environment variables](#environment-variables) below), then:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) — you'll be redirected to `/login`.

## Environment variables

Copy `.env.local.example` to `.env.local` and fill these in:

| Variable | Required | Notes |
| --- | --- | --- |
| `AUTH_SECRET` | Yes | Signs session cookies/JWTs. Generate with `openssl rand -base64 32`. |
| `NEXTAUTH_URL` | Production only | Base URL of the app. Auth.js infers it locally. |
| `MONGODB_URI` | Yes | MongoDB connection string. From Atlas: **Connect → Drivers**. Remember to allow-list your IP under **Network Access**. |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Optional | Enables "Continue with Google". Set up at [console.cloud.google.com](https://console.cloud.google.com/) → APIs & Services → Credentials. Redirect URI: `<your-url>/api/auth/callback/google`. |
| `AZURE_AD_CLIENT_ID` / `AZURE_AD_CLIENT_SECRET` | Optional | Enables "Continue with Microsoft". Set up at [portal.azure.com](https://portal.azure.com/) → Microsoft Entra ID → App registrations. Redirect URI: `<your-url>/api/auth/callback/microsoft-entra-id`. |
| `AZURE_AD_TENANT_ID` | Optional | Restricts Microsoft sign-in to a single tenant. Leave unset to allow any Microsoft account. |
| `APPLE_CLIENT_ID` / `APPLE_CLIENT_SECRET` | Optional | Enables "Continue with Apple". Requires a paid Apple Developer account and an HTTPS domain (no localhost). Redirect URI: `<your-url>/api/auth/callback/apple`. |

Each SSO button only appears once its two env vars are set — the app works fine with none of them configured, since email/password sign-in needs no external setup.

A translation with the **Claude** engine also needs an Anthropic API key, but that's entered per-session in the app's UI, not as an environment variable.

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start the dev server at `localhost:3000` |
| `npm run build` | Production build |
| `npm run start` | Run the production build |
| `npm run lint` | Lint the codebase |

## How authentication works

Sessions use JWT strategy (no database sessions). Every route except `/login` and `/api/signup` requires a session — enforced in `middleware.ts`. On first sign-in (any method), a matching record is created in the `users` collection, and its Mongo `_id` becomes the app's stable user id, used to scope translation history per account.

Email/password accounts are stored with a salted, hashed password (Node's built-in `scrypt` — no extra dependency); OAuth accounts never have a password on file.

## Deployment

This is a standard Next.js app — it deploys cleanly to [Vercel](https://vercel.com/) or any Node.js host that runs `npm run build && npm run start`. Set the same environment variables in your hosting provider, and make sure `NEXTAUTH_URL` (or `AUTH_URL`) is set to your production URL and each OAuth provider's redirect URI is updated to match.
