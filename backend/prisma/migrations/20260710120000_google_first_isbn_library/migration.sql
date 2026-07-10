-- Move owner library identity from shared Book rows to ISBNs stored on LibraryItem.
-- The shared Book table becomes a replaceable provider metadata cache.

ALTER TABLE "LibraryItem"
ADD COLUMN "isbn10" TEXT,
ADD COLUMN "isbn13" TEXT;

UPDATE "LibraryItem" AS item
SET
  "isbn10" = book."isbn10",
  "isbn13" = book."isbn13"
FROM "Book" AS book
WHERE item."bookId" = book."id";

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "LibraryItem"
    WHERE COALESCE(NULLIF("isbn13", ''), NULLIF("isbn10", '')) IS NULL
  ) THEN
    RAISE EXCEPTION 'Cannot migrate LibraryItem rows without isbn13 or isbn10.';
  END IF;
END $$;

ALTER TABLE "LibraryItem" DROP CONSTRAINT "LibraryItem_bookId_fkey";

DROP INDEX IF EXISTS "LibraryItem_userId_bookId_key";
DROP INDEX IF EXISTS "LibraryItem_guestSessionId_bookId_key";

ALTER TABLE "LibraryItem" DROP COLUMN "bookId";

CREATE INDEX "LibraryItem_isbn10_idx" ON "LibraryItem"("isbn10");
CREATE INDEX "LibraryItem_isbn13_idx" ON "LibraryItem"("isbn13");

DELETE FROM "BookRelation";
DELETE FROM "BookSeriesEntry";
DELETE FROM "BookSeries";
DELETE FROM "Book";
