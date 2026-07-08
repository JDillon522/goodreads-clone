-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'USER');

-- AlterTable
ALTER TABLE "User"
ADD COLUMN "username" TEXT,
ADD COLUMN "role" "UserRole" NOT NULL DEFAULT 'USER',
ADD COLUMN "deactivatedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Shelf" ADD COLUMN "deactivatedAt" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- Make Unshelved the first real default shelf for every existing user owner.
UPDATE "Shelf"
SET "position" = "position" + 1
WHERE "userId" IS NOT NULL
  AND "slug" <> 'unshelved';

INSERT INTO "Shelf" ("id", "userId", "name", "slug", "position", "isDefault", "createdAt", "updatedAt")
SELECT gen_random_uuid(), "id", 'Unshelved', 'unshelved', 0, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "User"
WHERE NOT EXISTS (
  SELECT 1
  FROM "Shelf"
  WHERE "Shelf"."userId" = "User"."id"
    AND "Shelf"."slug" = 'unshelved'
);

UPDATE "Shelf"
SET "name" = 'Unshelved',
    "position" = 0,
    "isDefault" = true,
    "deactivatedAt" = NULL
WHERE "userId" IS NOT NULL
  AND "slug" = 'unshelved';

-- Make Unshelved the first real default shelf for every existing guest owner.
UPDATE "Shelf"
SET "position" = "position" + 1
WHERE "guestSessionId" IS NOT NULL
  AND "slug" <> 'unshelved';

INSERT INTO "Shelf" ("id", "guestSessionId", "name", "slug", "position", "isDefault", "createdAt", "updatedAt")
SELECT gen_random_uuid(), "id", 'Unshelved', 'unshelved', 0, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "GuestSession"
WHERE NOT EXISTS (
  SELECT 1
  FROM "Shelf"
  WHERE "Shelf"."guestSessionId" = "GuestSession"."id"
    AND "Shelf"."slug" = 'unshelved'
);

UPDATE "Shelf"
SET "name" = 'Unshelved',
    "position" = 0,
    "isDefault" = true,
    "deactivatedAt" = NULL
WHERE "guestSessionId" IS NOT NULL
  AND "slug" = 'unshelved';

-- Newly added books default to Unshelved.
UPDATE "UserPreference" AS preference
SET "defaultShelfId" = shelf."id"
FROM "Shelf" AS shelf
WHERE preference."userId" = shelf."userId"
  AND shelf."slug" = 'unshelved';

UPDATE "UserPreference" AS preference
SET "defaultShelfId" = shelf."id"
FROM "Shelf" AS shelf
WHERE preference."guestSessionId" = shelf."guestSessionId"
  AND shelf."slug" = 'unshelved';
