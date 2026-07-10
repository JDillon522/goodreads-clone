-- CreateEnum
CREATE TYPE "GoogleBooksSyncStatus" AS ENUM ('FAILED', 'NOT_FOUND', 'PENDING', 'SYNCED');

-- AlterTable
ALTER TABLE "Book"
ADD COLUMN "googleBooksVolumeId" TEXT,
ADD COLUMN "googleBooksSyncedAt" TIMESTAMP(3),
ADD COLUMN "googleBooksSyncStatus" "GoogleBooksSyncStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN "googleBooksRawPayload" JSONB,
ADD COLUMN "googleBooksError" TEXT;

