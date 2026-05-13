ALTER TABLE "Article" ADD COLUMN "isFavorite" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Article" ADD COLUMN "isBookmarked" BOOLEAN NOT NULL DEFAULT false;

DELETE FROM "Article"
WHERE "writerId" IN (
  SELECT atlantic.id
  FROM "Writer" atlantic
  WHERE regexp_replace(atlantic."sourceUrl", '/$', '') = 'https://www.theatlantic.com/feed/all'
    AND EXISTS (
      SELECT 1
      FROM "Writer" derek
      WHERE derek."userId" = atlantic."userId"
        AND regexp_replace(derek."sourceUrl", '/$', '') = 'https://www.derekthompson.org/feed'
    )
);

DELETE FROM "Writer" atlantic
WHERE regexp_replace(atlantic."sourceUrl", '/$', '') = 'https://www.theatlantic.com/feed/all'
  AND EXISTS (
    SELECT 1
    FROM "Writer" derek
    WHERE derek."userId" = atlantic."userId"
      AND regexp_replace(derek."sourceUrl", '/$', '') = 'https://www.derekthompson.org/feed'
  );

DELETE FROM "Article"
WHERE "writerId" IN (
  SELECT id
  FROM "Writer"
  WHERE regexp_replace("sourceUrl", '/$', '') = 'https://www.theatlantic.com/feed/all'
);

UPDATE "Writer"
SET
  "name" = 'Derek Thompson',
  "publication" = 'A newsletter about abundance and building a better world.',
  "sourceUrl" = 'https://www.derekthompson.org/feed',
  "sourceType" = 'RSS',
  "lastCheckedAt" = NULL,
  "updatedAt" = NOW()
WHERE regexp_replace("sourceUrl", '/$', '') = 'https://www.theatlantic.com/feed/all';
