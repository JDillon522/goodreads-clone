-- CreateEnum
CREATE TYPE "ActivityEventType" AS ENUM ('BOOK_ADDED', 'BOOK_MOVED', 'PROGRESS_UPDATED', 'BOOK_FINISHED', 'RATING_UPDATED', 'NOTES_UPDATED', 'GOAL_SET', 'GOAL_COMPLETED', 'SHELF_CREATED', 'SHELF_RENAMED', 'SHELF_DELETED', 'GUEST_SESSION_CREATED');

-- CreateEnum
CREATE TYPE "BookProvider" AS ENUM ('GOOGLE_BOOKS', 'MANUAL', 'OPEN_LIBRARY', 'SAMPLE');

-- CreateEnum
CREATE TYPE "ProgressTrackingMode" AS ENUM ('PAGE', 'PERCENT');

-- CreateEnum
CREATE TYPE "ThemePreference" AS ENUM ('DARK', 'LIGHT', 'SYSTEM');

-- CreateTable
CREATE TABLE "User" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "displayName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuthRefreshToken" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "userAgent" TEXT,
    "ipAddress" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AuthRefreshToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PasswordResetToken" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PasswordResetToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GuestSession" (
    "id" UUID NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "label" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GuestSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Book" (
    "id" UUID NOT NULL,
    "sourceProvider" "BookProvider" NOT NULL,
    "sourceId" TEXT NOT NULL,
    "sourceUrl" TEXT,
    "openLibraryWorkKey" TEXT,
    "openLibraryEditionKey" TEXT,
    "title" TEXT NOT NULL,
    "subtitle" TEXT,
    "primaryAuthor" TEXT,
    "authors" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "description" TEXT,
    "publisher" TEXT,
    "publishedDate" TEXT,
    "pageCount" INTEGER,
    "coverUrl" TEXT,
    "isbn10" TEXT,
    "isbn13" TEXT,
    "genres" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "normalizedTitle" TEXT NOT NULL,
    "normalizedPrimaryAuthor" TEXT,
    "rawProviderPayload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Book_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Shelf" (
    "id" UUID NOT NULL,
    "userId" UUID,
    "guestSessionId" UUID,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Shelf_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LibraryItem" (
    "id" UUID NOT NULL,
    "userId" UUID,
    "guestSessionId" UUID,
    "bookId" UUID NOT NULL,
    "shelfId" UUID NOT NULL,
    "dedupeKey" TEXT NOT NULL,
    "rating" INTEGER,
    "notes" TEXT,
    "currentPage" INTEGER,
    "currentPercent" DECIMAL(5,2),
    "progressUpdatedAt" TIMESTAMP(3),
    "dateAdded" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dateFinished" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LibraryItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReadingProgressEntry" (
    "id" UUID NOT NULL,
    "libraryItemId" UUID NOT NULL,
    "trackingMode" "ProgressTrackingMode" NOT NULL,
    "currentPage" INTEGER,
    "currentPercent" DECIMAL(5,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReadingProgressEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReadingGoal" (
    "id" UUID NOT NULL,
    "userId" UUID,
    "guestSessionId" UUID,
    "year" INTEGER NOT NULL,
    "targetBooks" INTEGER NOT NULL,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReadingGoal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserPreference" (
    "id" UUID NOT NULL,
    "userId" UUID,
    "guestSessionId" UUID,
    "theme" "ThemePreference" NOT NULL DEFAULT 'SYSTEM',
    "defaultShelfId" UUID,
    "displayMode" TEXT NOT NULL DEFAULT 'grid',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserPreference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActivityEvent" (
    "id" UUID NOT NULL,
    "userId" UUID,
    "guestSessionId" UUID,
    "libraryItemId" UUID,
    "type" "ActivityEventType" NOT NULL,
    "metadata" JSONB,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActivityEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExternalBookCache" (
    "id" UUID NOT NULL,
    "provider" "BookProvider" NOT NULL,
    "providerKey" TEXT NOT NULL,
    "query" TEXT,
    "rawPayload" JSONB NOT NULL,
    "normalizedResult" JSONB,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExternalBookCache_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "AuthRefreshToken_tokenHash_key" ON "AuthRefreshToken"("tokenHash");

-- CreateIndex
CREATE INDEX "AuthRefreshToken_userId_idx" ON "AuthRefreshToken"("userId");

-- CreateIndex
CREATE INDEX "AuthRefreshToken_expiresAt_idx" ON "AuthRefreshToken"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "PasswordResetToken_tokenHash_key" ON "PasswordResetToken"("tokenHash");

-- CreateIndex
CREATE INDEX "PasswordResetToken_userId_idx" ON "PasswordResetToken"("userId");

-- CreateIndex
CREATE INDEX "PasswordResetToken_expiresAt_idx" ON "PasswordResetToken"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "GuestSession_tokenHash_key" ON "GuestSession"("tokenHash");

-- CreateIndex
CREATE INDEX "GuestSession_expiresAt_idx" ON "GuestSession"("expiresAt");

-- CreateIndex
CREATE INDEX "Book_isbn10_idx" ON "Book"("isbn10");

-- CreateIndex
CREATE INDEX "Book_isbn13_idx" ON "Book"("isbn13");

-- CreateIndex
CREATE INDEX "Book_normalizedTitle_normalizedPrimaryAuthor_idx" ON "Book"("normalizedTitle", "normalizedPrimaryAuthor");

-- CreateIndex
CREATE UNIQUE INDEX "Book_sourceProvider_sourceId_key" ON "Book"("sourceProvider", "sourceId");

-- CreateIndex
CREATE INDEX "Shelf_userId_position_idx" ON "Shelf"("userId", "position");

-- CreateIndex
CREATE INDEX "Shelf_guestSessionId_position_idx" ON "Shelf"("guestSessionId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "Shelf_userId_slug_key" ON "Shelf"("userId", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "Shelf_guestSessionId_slug_key" ON "Shelf"("guestSessionId", "slug");

-- CreateIndex
CREATE INDEX "LibraryItem_shelfId_idx" ON "LibraryItem"("shelfId");

-- CreateIndex
CREATE INDEX "LibraryItem_dateFinished_idx" ON "LibraryItem"("dateFinished");

-- CreateIndex
CREATE INDEX "LibraryItem_rating_idx" ON "LibraryItem"("rating");

-- CreateIndex
CREATE UNIQUE INDEX "LibraryItem_userId_bookId_key" ON "LibraryItem"("userId", "bookId");

-- CreateIndex
CREATE UNIQUE INDEX "LibraryItem_guestSessionId_bookId_key" ON "LibraryItem"("guestSessionId", "bookId");

-- CreateIndex
CREATE UNIQUE INDEX "LibraryItem_userId_dedupeKey_key" ON "LibraryItem"("userId", "dedupeKey");

-- CreateIndex
CREATE UNIQUE INDEX "LibraryItem_guestSessionId_dedupeKey_key" ON "LibraryItem"("guestSessionId", "dedupeKey");

-- CreateIndex
CREATE INDEX "ReadingProgressEntry_libraryItemId_createdAt_idx" ON "ReadingProgressEntry"("libraryItemId", "createdAt");

-- CreateIndex
CREATE INDEX "ReadingGoal_year_idx" ON "ReadingGoal"("year");

-- CreateIndex
CREATE UNIQUE INDEX "ReadingGoal_userId_year_key" ON "ReadingGoal"("userId", "year");

-- CreateIndex
CREATE UNIQUE INDEX "ReadingGoal_guestSessionId_year_key" ON "ReadingGoal"("guestSessionId", "year");

-- CreateIndex
CREATE UNIQUE INDEX "UserPreference_userId_key" ON "UserPreference"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "UserPreference_guestSessionId_key" ON "UserPreference"("guestSessionId");

-- CreateIndex
CREATE INDEX "ActivityEvent_userId_occurredAt_idx" ON "ActivityEvent"("userId", "occurredAt");

-- CreateIndex
CREATE INDEX "ActivityEvent_guestSessionId_occurredAt_idx" ON "ActivityEvent"("guestSessionId", "occurredAt");

-- CreateIndex
CREATE INDEX "ActivityEvent_libraryItemId_idx" ON "ActivityEvent"("libraryItemId");

-- CreateIndex
CREATE INDEX "ActivityEvent_type_idx" ON "ActivityEvent"("type");

-- CreateIndex
CREATE INDEX "ExternalBookCache_query_idx" ON "ExternalBookCache"("query");

-- CreateIndex
CREATE INDEX "ExternalBookCache_expiresAt_idx" ON "ExternalBookCache"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "ExternalBookCache_provider_providerKey_key" ON "ExternalBookCache"("provider", "providerKey");

-- AddForeignKey
ALTER TABLE "AuthRefreshToken" ADD CONSTRAINT "AuthRefreshToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PasswordResetToken" ADD CONSTRAINT "PasswordResetToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Shelf" ADD CONSTRAINT "Shelf_guestSessionId_fkey" FOREIGN KEY ("guestSessionId") REFERENCES "GuestSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Shelf" ADD CONSTRAINT "Shelf_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LibraryItem" ADD CONSTRAINT "LibraryItem_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "Book"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LibraryItem" ADD CONSTRAINT "LibraryItem_guestSessionId_fkey" FOREIGN KEY ("guestSessionId") REFERENCES "GuestSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LibraryItem" ADD CONSTRAINT "LibraryItem_shelfId_fkey" FOREIGN KEY ("shelfId") REFERENCES "Shelf"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LibraryItem" ADD CONSTRAINT "LibraryItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReadingProgressEntry" ADD CONSTRAINT "ReadingProgressEntry_libraryItemId_fkey" FOREIGN KEY ("libraryItemId") REFERENCES "LibraryItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReadingGoal" ADD CONSTRAINT "ReadingGoal_guestSessionId_fkey" FOREIGN KEY ("guestSessionId") REFERENCES "GuestSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReadingGoal" ADD CONSTRAINT "ReadingGoal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserPreference" ADD CONSTRAINT "UserPreference_guestSessionId_fkey" FOREIGN KEY ("guestSessionId") REFERENCES "GuestSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserPreference" ADD CONSTRAINT "UserPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityEvent" ADD CONSTRAINT "ActivityEvent_guestSessionId_fkey" FOREIGN KEY ("guestSessionId") REFERENCES "GuestSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityEvent" ADD CONSTRAINT "ActivityEvent_libraryItemId_fkey" FOREIGN KEY ("libraryItemId") REFERENCES "LibraryItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityEvent" ADD CONSTRAINT "ActivityEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
