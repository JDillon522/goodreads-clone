-- CreateEnum
CREATE TYPE "LibraryItemStatus" AS ENUM ('READ', 'READING', 'WANT_TO_READ');

-- AlterTable
ALTER TABLE "LibraryItem" ADD COLUMN "status" "LibraryItemStatus" NOT NULL DEFAULT 'WANT_TO_READ';

-- Backfill status from the previous single-shelf model.
UPDATE "LibraryItem" AS item
SET "status" = CASE
  WHEN item."dateFinished" IS NOT NULL THEN 'READ'::"LibraryItemStatus"
  WHEN shelf."slug" = 'read' THEN 'READ'::"LibraryItemStatus"
  WHEN shelf."slug" = 'currently-reading' THEN 'READING'::"LibraryItemStatus"
  ELSE 'WANT_TO_READ'::"LibraryItemStatus"
END
FROM "Shelf" AS shelf
WHERE item."shelfId" = shelf."id";

-- CreateTable
CREATE TABLE "LibraryItemShelf" (
  "id" UUID NOT NULL,
  "libraryItemId" UUID NOT NULL,
  "shelfId" UUID NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "LibraryItemShelf_pkey" PRIMARY KEY ("id")
);

-- Backfill shelf memberships from the previous single-shelf model.
INSERT INTO "LibraryItemShelf" ("id", "libraryItemId", "shelfId", "createdAt")
SELECT gen_random_uuid(), "id", "shelfId", "createdAt"
FROM "LibraryItem";

-- DropForeignKey
ALTER TABLE "LibraryItem" DROP CONSTRAINT "LibraryItem_shelfId_fkey";

-- DropIndex
DROP INDEX "LibraryItem_shelfId_idx";

-- AlterTable
ALTER TABLE "LibraryItem" DROP COLUMN "shelfId";

-- CreateIndex
CREATE INDEX "LibraryItem_status_idx" ON "LibraryItem"("status");

-- CreateIndex
CREATE UNIQUE INDEX "LibraryItemShelf_libraryItemId_shelfId_key" ON "LibraryItemShelf"("libraryItemId", "shelfId");

-- CreateIndex
CREATE INDEX "LibraryItemShelf_shelfId_idx" ON "LibraryItemShelf"("shelfId");

-- AddForeignKey
ALTER TABLE "LibraryItemShelf" ADD CONSTRAINT "LibraryItemShelf_libraryItemId_fkey" FOREIGN KEY ("libraryItemId") REFERENCES "LibraryItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LibraryItemShelf" ADD CONSTRAINT "LibraryItemShelf_shelfId_fkey" FOREIGN KEY ("shelfId") REFERENCES "Shelf"("id") ON DELETE CASCADE ON UPDATE CASCADE;
