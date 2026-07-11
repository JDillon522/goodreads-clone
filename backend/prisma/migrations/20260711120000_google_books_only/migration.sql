-- Remove the retired Open Library provider without touching ISBN-owned library state.
-- Shared metadata, series, and relation rows are replaceable caches and will be rebuilt from
-- the committed Google Books snapshot or subsequent Google Books requests.

DELETE FROM "BookRelation";
DELETE FROM "BookSeriesEntry";
DELETE FROM "BookSeries";
DELETE FROM "Book";

DROP TABLE "ExternalBookCache";

ALTER TABLE "Book"
DROP COLUMN "openLibraryWorkKey",
DROP COLUMN "openLibraryEditionKey";

CREATE TYPE "BookProvider_new" AS ENUM ('GOOGLE_BOOKS', 'MANUAL', 'SAMPLE');

ALTER TABLE "Book"
ALTER COLUMN "sourceProvider" TYPE "BookProvider_new"
USING ("sourceProvider"::text::"BookProvider_new");

ALTER TABLE "BookSeries"
ALTER COLUMN "sourceProvider" TYPE "BookProvider_new"
USING ("sourceProvider"::text::"BookProvider_new");

ALTER TABLE "BookSeriesEntry"
ALTER COLUMN "sourceProvider" TYPE "BookProvider_new"
USING ("sourceProvider"::text::"BookProvider_new");

ALTER TABLE "BookRelation"
ALTER COLUMN "sourceProvider" TYPE "BookProvider_new"
USING ("sourceProvider"::text::"BookProvider_new");

DROP TYPE "BookProvider";
ALTER TYPE "BookProvider_new" RENAME TO "BookProvider";
