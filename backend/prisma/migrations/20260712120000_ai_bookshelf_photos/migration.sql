-- Add explicitly saved, user-owned bookshelf photos and normalized spine detections.
-- Existing users, guest sessions, library items, and replaceable metadata caches are untouched.

CREATE TYPE "BookshelfPhotoKind" AS ENUM ('SHELF', 'WALL');

CREATE TABLE "BookshelfPhoto" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "parentPhotoId" UUID,
    "kind" "BookshelfPhotoKind" NOT NULL DEFAULT 'SHELF',
    "label" TEXT NOT NULL,
    "imageData" BYTEA NOT NULL,
    "imageMimeType" TEXT NOT NULL,
    "imageWidth" INTEGER NOT NULL,
    "imageHeight" INTEGER NOT NULL,
    "thumbnailData" BYTEA NOT NULL,
    "thumbnailMimeType" TEXT NOT NULL DEFAULT 'image/webp',
    "parentRegion" JSONB,
    "gridColumnLabel" TEXT,
    "gridRowLabel" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BookshelfPhoto_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BookshelfDetection" (
    "id" UUID NOT NULL,
    "photoId" UUID NOT NULL,
    "libraryItemId" UUID,
    "position" INTEGER NOT NULL,
    "observedSpineText" TEXT NOT NULL,
    "observedTitle" TEXT,
    "observedAuthors" TEXT[] NOT NULL,
    "observedPublisher" TEXT,
    "observedIsbn10" TEXT,
    "observedIsbn13" TEXT,
    "confidence" INTEGER NOT NULL,
    "x" INTEGER NOT NULL,
    "y" INTEGER NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "rotationDegrees" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "selectedGoogleBooksVolumeId" TEXT,
    "selectedBookSnapshot" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BookshelfDetection_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "BookshelfPhoto_userId_createdAt_idx" ON "BookshelfPhoto"("userId", "createdAt");
CREATE INDEX "BookshelfPhoto_parentPhotoId_idx" ON "BookshelfPhoto"("parentPhotoId");
CREATE UNIQUE INDEX "BookshelfDetection_photoId_position_key" ON "BookshelfDetection"("photoId", "position");
CREATE INDEX "BookshelfDetection_libraryItemId_idx" ON "BookshelfDetection"("libraryItemId");
CREATE INDEX "BookshelfDetection_selectedGoogleBooksVolumeId_idx" ON "BookshelfDetection"("selectedGoogleBooksVolumeId");

ALTER TABLE "BookshelfPhoto"
ADD CONSTRAINT "BookshelfPhoto_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "BookshelfPhoto"
ADD CONSTRAINT "BookshelfPhoto_parentPhotoId_fkey"
FOREIGN KEY ("parentPhotoId") REFERENCES "BookshelfPhoto"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "BookshelfDetection"
ADD CONSTRAINT "BookshelfDetection_photoId_fkey"
FOREIGN KEY ("photoId") REFERENCES "BookshelfPhoto"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "BookshelfDetection"
ADD CONSTRAINT "BookshelfDetection_libraryItemId_fkey"
FOREIGN KEY ("libraryItemId") REFERENCES "LibraryItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
