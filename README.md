# Arabic Document Translator (Next.js)

Full-stack Next.js app that translates Arabic PDFs, images, and government
documents into English, with an accuracy indicator and per-user history.
Frontend is Next.js (App Router) + Tailwind CSS + shadcn/ui; backend is
TypeScript Route Handlers. Sign-in is required (Google, Microsoft, or Apple
SSO via Auth.js), and every translation is saved to MongoDB under your
account so it's there next time you sign in, from any device.

## Features

- **Sign in with Google, Microsoft, or Apple** — Auth.js (NextAuth v5),
  JWT sessions, redirect-based OAuth flow with per-button loading states
  and friendly error messages on the login screen.
- **Login required**: the whole app is gated behind `middleware.ts`;
  unauthenticated page requests redirect to `/login`, unauthenticated API
  requests get a `401` JSON response instead.
- **Three translation engines**: Claude (best quality, handwriting-capable
  vision pipeline), Google Translate (free), MyMemory (free, real quality
  score). See "Translation engines" below.
- **Persistent, per-user history** in MongoDB (via Mongoose) — a
  date-grouped list, click to open full results in a dialog, delete
  entries you don't want to keep.
- **Structure-preserving translation** — paragraphs, bullets, and numbered
  lists survive translation instead of collapsing into one blob.

## Setup

### 1. Install dependencies

```
cd arabic-translator-next
npm install
```

### 2. Environment variables

```
cp .env.local.example .env.local
```

Then fill in `.env.local`:

- `AUTH_SECRET` — random string, e.g. `openssl rand -base64 32`.
- Google, Microsoft, and/or Apple OAuth credentials — see the walkthroughs
  below. **You only need to configure the providers you want to offer** —
  the login screen only shows buttons for providers with credentials set.
- `MONGODB_URI` — a MongoDB connection string (Atlas walkthrough below).

### 3. Run

```
npm run dev
```

Open http://localhost:3000 — you'll land on `/login`.

## Setting up each SSO provider

### Google

1. [console.cloud.google.com](https://console.cloud.google.com) → create/select a project.
2. **APIs & Services → OAuth consent screen**: app name, support email,
   user type "External" (unless restricted to a Google Workspace).
3. **APIs & Services → Credentials → Create Credentials → OAuth client ID**,
   application type **Web application**.
4. Authorized redirect URIs:
   - `http://localhost:3000/api/auth/callback/google` (dev)
   - `https://yourdomain.com/api/auth/callback/google` (prod)
5. Copy **Client ID** / **Client Secret** into `GOOGLE_CLIENT_ID` /
   `GOOGLE_CLIENT_SECRET`.

### Microsoft (Entra ID)

1. [portal.azure.com](https://portal.azure.com) → **Microsoft Entra ID →
   App registrations → New registration**.
2. Name it. Account types: "Accounts in any organizational directory and
   personal Microsoft accounts" allows anyone to sign in; pick a narrower
   option to restrict to your org.
3. Redirect URI, platform **Web**:
   `http://localhost:3000/api/auth/callback/microsoft-entra-id`
   (add the prod URL too once deployed).
4. Copy the **Application (client) ID** → `AZURE_AD_CLIENT_ID`. Only set
   `AZURE_AD_TENANT_ID` (the Directory/tenant ID) if you want to restrict
   sign-in to a single organization — leave unset for the broadest
   "common" endpoint (work, school, and personal accounts).
5. **Certificates & secrets → New client secret** → copy the **value**
   immediately (shown once) → `AZURE_AD_CLIENT_SECRET`.

### Apple (Sign in with Apple)

The involved one — requires a **paid Apple Developer account** ($99/yr)
and **HTTPS only** (no localhost; use a tunnel like ngrok for local dev).

1. [developer.apple.com/account](https://developer.apple.com/account) →
   **Certificates, IDs & Profiles → Identifiers** → register an **App ID**
   with "Sign in with Apple" enabled.
2. Register a **Services ID** (this is your `client_id`). Enable Sign in
   with Apple on it, and configure your domain + return URL:
   `https://yourdomain.com/api/auth/callback/apple`.
3. **Keys** → new key with "Sign in with Apple" enabled → download the
   `.p8` private key (only downloadable once — keep it safe).
4. Apple's "client secret" is a JWT you sign yourself (Team ID, Key ID,
   Services ID, ≤6 month expiry — needs periodic regeneration). Run:
   ```
   npx auth add apple
   ```
   and follow the prompts (Team ID, Key ID, Services ID, path to the
   `.p8` file); copy the generated value into `APPLE_CLIENT_SECRET`.

### MongoDB Atlas

1. Free account at [cloud.mongodb.com](https://cloud.mongodb.com) →
   create a free M0 cluster.
2. **Database Access** → add a database user + password.
3. **Network Access** → allow-list your IP (or `0.0.0.0/0` while testing —
   tighten this before going to production).
4. **Connect → Drivers** → copy the `mongodb+srv://...` string, swap in
   the real password, set as `MONGODB_URI`.

## Translation engines

- **Claude API** — best quality, and the only engine that handles
  **handwritten or poor-quality documents**. Born-digital PDFs use a fast
  native-text-extraction path (`pdf-parse`); everything else (images,
  scans, handwritten pages) is rendered to page images and sent to Claude
  in vision mode, which transcribes and translates in one pass. Requires
  an Anthropic API key **with credits**, entered per-request in the
  composer (used only for that request, never stored).
- **Google Translate (free)** — no API key. Uses Google's public translate
  endpoint directly. Unofficial, so it can occasionally be rate-limited.
- **MyMemory (free)** — no API key. Returns a genuine match/quality score
  per request (not a heuristic). Modest daily cap for anonymous use.

**Note on offline translation:** there's no fully-offline engine in this
version (the earlier Flask prototype had one via Argos Translate). No
equivalent installs reliably across platforms in the Node ecosystem
without native binaries — see the code comments in `src/lib/engines/` if
you want to add a self-hosted [LibreTranslate](https://github.com/LibreTranslate/LibreTranslate)
engine later; the `translateStructured` wrapper in `src/lib/chunk.ts` is
generic enough to plug into.

## How extraction works

- **Native PDF text**: `pdf-parse` pulls embedded text directly.
- **OCR (Google/MyMemory paths)**: `tesseract.js` (Arabic language pack)
  with layout reconstruction from Tesseract's block → paragraph → line →
  word hierarchy, so bullets and paragraph breaks survive OCR. Tesseract
  isn't built for handwriting, no matter the preprocessing.
- **Claude vision (images / scanned or handwritten PDFs)**: pages are
  rendered to PNG (`pdf-parse`'s built-in renderer, backed by
  `pdfjs-dist` + `@napi-rs/canvas`) and sent directly to Claude.

## Accuracy score

- **Claude**: primarily the model's own self-reported confidence,
  blended with OCR confidence when OCR was used, minus penalties for very
  short or non-Arabic-looking extracted text.
- **MyMemory**: same blend, using MyMemory's real match/quality score.
- **Google Translate (free)**: no genuine confidence exists, so it falls
  back to OCR confidence (or an assumed baseline for native PDF/typed
  text). Treat as a proxy for extraction quality, not translation quality.

## Authentication & data model

- **Auth.js v5**, JWT session strategy (no separate session store) —
  session cookie carries a stable app-level user id.
- On first sign-in with a given email, a `User` document is upserted in
  MongoDB (`src/lib/models/user.ts`) keyed by email; the Mongo `_id` is
  embedded in the JWT so subsequent requests don't need a DB round trip
  just to identify the user.
- Every successful translation writes a `TranslationHistory` document
  (`src/lib/models/translation-history.ts`) linked to that user id.
- `middleware.ts` protects every route except `/login` and the Auth.js API
  routes; API routes return `401` JSON instead of redirecting, since
  they're called via `fetch`, not navigation.
- Signing in with the same email via a different provider links to the
  same `User` document (matched by email) — so switching from "continue
  with Google" to "continue with Microsoft" later, using the same email,
  reuses your existing history.

## Project structure

```
auth.ts                        Auth.js config (providers, callbacks)
middleware.ts                  Route protection
src/
  app/
    api/
      auth/[...nextauth]/       Auth.js route handler
      translate/route.ts        Translate + save to history
      history/route.ts          List / delete history (GET, DELETE)
    login/page.tsx               Sign-in screen
    page.tsx, layout.tsx         App shell (server components)
  components/
    translator-app.tsx           Composer + history list (client)
    result-dialog.tsx             Result dialog (client)
    sign-in-buttons.tsx            Google/Microsoft/Apple buttons (client)
    user-menu.tsx                   Avatar + sign-out dropdown (client)
    ui/                             shadcn/ui primitives
  lib/
    mongodb.ts, models/              Mongoose connection + schemas
    get-or-create-user.ts             User upsert helper
    auth-providers.ts                  Which SSO providers are configured
    types.ts, client-types.ts          Shared types
    chunk.ts, metrics.ts, pdf.ts, ocr.ts, pipeline.ts
    engines/claude.ts, google.ts, mymemory.ts
```

## Notes & limits

- Max upload: 25MB. Formats: PDF, PNG, JPG/JPEG, TIFF, BMP, WEBP (BMP/TIFF
  work for OCR; Claude's vision API only accepts PNG/JPEG/WEBP/GIF
  natively, so BMP/TIFF sent to Claude may fail — convert to PNG first).
- Route handlers run with `runtime = "nodejs"` and `maxDuration = 300`;
  multi-page handwritten PDFs on the Claude backend make one API call per
  page and can take a while.
- No system dependencies needed (`tesseract.js` runs via WASM and
  downloads the Arabic language pack from a CDN on first OCR use;
  `pdf-parse` bundles its own PDF rendering) — both need internet on first
  use.
- This calls third-party APIs (Anthropic, Google's translate endpoint,
  MyMemory) directly from the server, and MongoDB for storage — for a
  production deployment, add rate limiting and rotate the `AUTH_SECRET`
  and database credentials periodically.
