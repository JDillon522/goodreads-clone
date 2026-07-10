-- Preserve duplicated legacy metadata in JSON, then slim Book to lookup/index fields plus raw provider payloads.

UPDATE "Book"
SET "rawProviderPayload" =
  jsonb_set(
    COALESCE("rawProviderPayload", '{}'::jsonb),
    '{legacy}',
    jsonb_strip_nulls(
      jsonb_build_object(
        'title', "title",
        'subtitle', "subtitle",
        'primaryAuthor', "primaryAuthor",
        'authors', "authors",
        'description', "description",
        'publisher', "publisher",
        'publishedDate', "publishedDate",
        'pageCount', "pageCount",
        'coverUrl', "coverUrl",
        'genres', "genres",
        'isbn10', "isbn10",
        'isbn13', "isbn13"
      )
    ),
    true
  );

ALTER TABLE "Book"
DROP COLUMN "title",
DROP COLUMN "subtitle",
DROP COLUMN "primaryAuthor",
DROP COLUMN "authors",
DROP COLUMN "description",
DROP COLUMN "publisher",
DROP COLUMN "publishedDate",
DROP COLUMN "pageCount",
DROP COLUMN "coverUrl",
DROP COLUMN "genres";
