# Writer Reader MVP

A compact Google Reader-like app for following individual writers by RSS/Atom feed URL or author page URL.

## Stack

- Next.js App Router
- TypeScript
- PostgreSQL
- Prisma
- Tailwind CSS
- `rss-parser` for RSS/Atom
- `cheerio` for generic author page extraction

## Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create an environment file:

   ```bash
   cp .env.example .env
   ```

3. Start PostgreSQL, or point `DATABASE_URL` at an existing database:

   ```bash
   npm run db:up
   ```

   If Docker is not available, this project also includes an embedded local
   PostgreSQL runner:

   ```bash
   npm run db:embedded
   ```

4. Run the migration and generate Prisma Client:

   ```bash
   npm run prisma:migrate
   ```

5. Configure AI-assisted source lookup:

   ```bash
   OPENAI_API_KEY="sk-..."
   OPENAI_MODEL="gpt-4.1-mini"
   ```

6. Optional seed data:

   ```bash
   npm run seed
   ```

7. Start the app:

   ```bash
   npm run dev
   ```

Open `http://localhost:3000`.

## Accounts and per-user data

Writer Reader now requires an account before the reader loads. Each saved writer
belongs to the signed-in user, and article queries are filtered through that
user's writers. This prevents different Android beta users from seeing each
other's saved sources.

For existing databases, run migrations before deploying or testing:

```bash
npm run prisma:migrate
```

The user/session data is stored in PostgreSQL. Android keeps only a session
token on the device and sends it to the hosted API.

Adding a writer uses the backend to call OpenAI, generate likely RSS feed
candidates from a short description, validate those candidates, and preview the
first working source. The backend must have `OPENAI_API_KEY` configured.

If an existing local database had writers before accounts were added, migration
keeps those rows under `legacy@example.local`. After the real user signs up, move
that local data to the real account:

```bash
npm run data:claim-legacy -- user@example.com
```

Run this only once, before using that database as the source for a hosted/shared
database.

For a local database that predates accounts and should be treated as one
person's reader, assign every existing writer row to that user:

```bash
npm run data:claim-all -- user@example.com
```

## Android beta packaging

This repository includes a Capacitor Android wrapper for the existing web app.
It packages the exported web UI from `out/` into the Android project at
`android/app/src/main/assets/public`.

The reader still depends on the existing Next.js API routes and PostgreSQL
backend. The Android WebView cannot run those server routes or the database
inside the APK, so beta builds need a reachable hosted backend URL.

For the full hosted backend setup, see [docs/deployment.md](docs/deployment.md).

### Install dependencies

```bash
npm install
```

### Configure API access for Android

For a functional Android beta, set the public API base URL before building the
mobile assets:

```bash
NEXT_PUBLIC_API_BASE_URL="https://your-hosted-writer-reader.example.com"
```

On the hosted backend, optionally restrict CORS to Capacitor:

```bash
API_ALLOWED_ORIGIN="capacitor://localhost"
```

If `NEXT_PUBLIC_API_BASE_URL` is omitted, the bundled app will still open, but
the reader actions will try to call `/api/*` from the WebView origin and will
not reach the Next.js backend.

### Build the web app

Existing server build:

```bash
npm run build
```

Capacitor/static mobile build:

```bash
npm run build:mobile
```

`npm run build:mobile` temporarily excludes `app/api` while running Next static
export, then restores it. This keeps the normal Next server/API deployment path
unchanged while producing the `out/` directory needed by Capacitor.

### Sync Capacitor

```bash
npm run cap:sync
```

This rebuilds the static web assets and copies them into the Android project.
To sync without rebuilding after a completed mobile build, run:

```bash
npx cap sync android
```

### Open the Android project

```bash
npm run cap:open
```

This opens the generated `android/` project in Android Studio.

### Build or run a debug APK

From Android Studio, choose the `app` configuration and run it on an emulator or
device. From the command line:

```bash
cd android
./gradlew assembleDebug
```

The debug APK is written under `android/app/build/outputs/apk/debug/`.

### Known Android beta limitations

- The APK bundles the web UI only; it does not bundle PostgreSQL, Prisma server
  code, RSS polling, or the Next.js API routes.
- A hosted backend with `DATABASE_URL` configured is required for real reader
  behavior in beta builds.
- Users must sign up or log in on each device. Their writers/articles persist
  in the hosted PostgreSQL database under their account.
- Cross-origin WebView calls require CORS. This repo adds CORS headers to the
  API routes and supports `API_ALLOWED_ORIGIN`.
- External article links open in the WebView/browser behavior provided by the
  platform; a later beta may want Capacitor Browser or App URL handling.
- App icons, splash assets, signing keys, versioning, and Play internal/closed
  testing setup are still follow-up release tasks.

## Polling

Run:

```bash
npm run poll
```

The poller checks every saved writer source, deduplicates by canonical URL, updates `lastCheckedAt`, and continues if one source fails.

## Launch Shortcut

On macOS, double-click `launch-writer-reader.command` from Finder or run:

```bash
./launch-writer-reader.command
```

It starts embedded PostgreSQL when needed, applies migrations, opens the app, and starts the Next.js dev server. If the app is already running, it simply opens `http://127.0.0.1:3000`.

## API

- `POST /api/resolve-source` with `{ "description": "..." }`
- `POST /api/preview-source` with `{ "url": "https://..." }`
- `POST /api/writers` with `{ "url": "https://..." }`
- `GET /api/writers`
- `DELETE /api/writers/:id`
- `GET /api/articles`
- `GET /api/articles?writerId=:id`
- `PATCH /api/articles/:id/read` with `{ "isRead": true }`

## Notes

The author page extractor is intentionally generic for the MVP. It scans anchor tags, keeps links that look like article URLs, infers titles from link text, and tries to find nearby dates from `time` elements or common date strings. `selectorConfig` is present in the schema so site-specific extraction rules can be added later.

The source finder also accepts direct RSS/Atom URLs. YouTube channel feeds can be added directly with `https://www.youtube.com/feeds/videos.xml?channel_id=...`, and common `/channel/...` YouTube URLs are converted to that feed format automatically.

When a writer description is resolved through the AI-assisted lookup, the preview shows the candidate sources that were tried and the first source that produced articles. Use this preview before saving to verify that the writer adder found the intended source.
