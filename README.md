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

5. Optional seed data:

   ```bash
   npm run seed
   ```

6. Start the app:

   ```bash
   npm run dev
   ```

Open `http://localhost:3000`.

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

- `POST /api/preview-source` with `{ "url": "https://..." }`
- `POST /api/writers` with `{ "url": "https://..." }`
- `GET /api/writers`
- `DELETE /api/writers/:id`
- `GET /api/articles`
- `GET /api/articles?writerId=:id`
- `PATCH /api/articles/:id/read` with `{ "isRead": true }`

## Notes

The author page extractor is intentionally generic for the MVP. It scans anchor tags, keeps links that look like article URLs, infers titles from link text, and tries to find nearby dates from `time` elements or common date strings. `selectorConfig` is present in the schema so site-specific extraction rules can be added later.
