# Hosted Backend Deployment

The Android app needs an internet-accessible backend. Embedded Postgres is only
for laptop development.

## Production Shape

```text
Android app
  -> hosted Next.js backend
  -> hosted Postgres database
```

Each user signs in to the same hosted backend. Writers and articles are stored
in Postgres under that user's account.

## 1. Create Hosted Postgres

Create a Postgres database with a provider such as Neon, Supabase, Railway, or
Render. Copy its connection string.

Set this environment variable on the backend host:

```bash
DATABASE_URL="postgresql://..."
```

## 2. Deploy The Next.js Backend

Deploy this repository to a Next.js host such as Vercel, Railway, or Render.

Required backend environment variables:

```bash
DATABASE_URL="postgresql://..."
OPENAI_API_KEY="sk-..."
OPENAI_MODEL="gpt-4.1-mini"
API_ALLOWED_ORIGIN="capacitor://localhost"
```

`API_ALLOWED_ORIGIN` can be left empty during early testing, but restrict it
before a wider beta.

## 3. Run Production Migrations

After the backend has `DATABASE_URL` configured, run:

```bash
npm run prisma:deploy
```

On hosts with a CLI, this can be run as a one-off command. For Vercel, run it
locally with the production `DATABASE_URL` available, or from the provider's
deployment shell if one is available.

## 4. Check The Backend

Open:

```text
https://your-hosted-backend.example.com/api/health
```

Expected response:

```json
{"ok":true}
```

The AI-assisted writer lookup will not work until `OPENAI_API_KEY` is set on
the backend deployment.

## 5. Build Android Against Hosted Backend

From the repo:

```bash
NEXT_PUBLIC_API_BASE_URL="https://your-hosted-backend.example.com" npm run cap:sync
```

Then open Android Studio:

```bash
npm run cap:open
```

Run the app on a phone or build an APK/AAB. The installed Android app will call
the hosted backend, so it works away from the laptop and off the local Wi-Fi.

## Importing Existing Local Data

If one local laptop database contains pre-account writer data, first run
migrations, sign in or create that user's account, then assign the existing rows
to that user:

```bash
npm run data:claim-all -- user@example.com
```

After that, export/import that Postgres database into the hosted Postgres
database, or use provider tooling such as `pg_dump` and `pg_restore`.
