-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- Preserve existing single-user data under a legacy local account.
INSERT INTO "User" ("id", "email", "passwordHash", "createdAt", "updatedAt")
VALUES ('legacy-local-user', 'legacy@example.local', 'disabled', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- Drop old global uniqueness before adding user scope.
DROP INDEX IF EXISTS "Writer_sourceUrl_key";
DROP INDEX IF EXISTS "Article_canonicalUrl_key";

-- AlterTable
ALTER TABLE "Writer" ADD COLUMN "userId" TEXT;
UPDATE "Writer" SET "userId" = 'legacy-local-user' WHERE "userId" IS NULL;
ALTER TABLE "Writer" ALTER COLUMN "userId" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX "Session_tokenHash_key" ON "Session"("tokenHash");
CREATE INDEX "Session_userId_idx" ON "Session"("userId");
CREATE INDEX "Session_expiresAt_idx" ON "Session"("expiresAt");
CREATE UNIQUE INDEX "Writer_userId_sourceUrl_key" ON "Writer"("userId", "sourceUrl");
CREATE INDEX "Writer_userId_idx" ON "Writer"("userId");
CREATE UNIQUE INDEX "Article_writerId_canonicalUrl_key" ON "Article"("writerId", "canonicalUrl");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Writer" ADD CONSTRAINT "Writer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
