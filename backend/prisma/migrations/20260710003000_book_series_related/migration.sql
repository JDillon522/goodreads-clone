-- CreateEnum
CREATE TYPE "BookRelationType" AS ENUM ('RELATED', 'SAME_AUTHOR', 'SAME_SERIES', 'SAME_SUBJECT');

-- CreateTable
CREATE TABLE "BookSeries" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "sourceProvider" "BookProvider",
    "sourceId" TEXT,
    "confidence" INTEGER NOT NULL DEFAULT 50,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BookSeries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BookSeriesEntry" (
    "id" UUID NOT NULL,
    "seriesId" UUID NOT NULL,
    "bookId" UUID NOT NULL,
    "position" DOUBLE PRECISION,
    "positionLabel" TEXT,
    "sourceProvider" "BookProvider",
    "confidence" INTEGER NOT NULL DEFAULT 50,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BookSeriesEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BookRelation" (
    "id" UUID NOT NULL,
    "sourceBookId" UUID NOT NULL,
    "targetBookId" UUID NOT NULL,
    "type" "BookRelationType" NOT NULL,
    "score" INTEGER NOT NULL,
    "reasons" JSONB NOT NULL,
    "sourceProvider" "BookProvider",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BookRelation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BookSeries_normalizedName_key" ON "BookSeries"("normalizedName");

-- CreateIndex
CREATE UNIQUE INDEX "BookSeriesEntry_seriesId_bookId_key" ON "BookSeriesEntry"("seriesId", "bookId");

-- CreateIndex
CREATE INDEX "BookSeriesEntry_bookId_idx" ON "BookSeriesEntry"("bookId");

-- CreateIndex
CREATE INDEX "BookSeriesEntry_seriesId_position_idx" ON "BookSeriesEntry"("seriesId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "BookRelation_sourceBookId_targetBookId_type_key" ON "BookRelation"("sourceBookId", "targetBookId", "type");

-- CreateIndex
CREATE INDEX "BookRelation_sourceBookId_score_idx" ON "BookRelation"("sourceBookId", "score");

-- CreateIndex
CREATE INDEX "BookRelation_targetBookId_idx" ON "BookRelation"("targetBookId");

-- AddForeignKey
ALTER TABLE "BookSeriesEntry" ADD CONSTRAINT "BookSeriesEntry_seriesId_fkey" FOREIGN KEY ("seriesId") REFERENCES "BookSeries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookSeriesEntry" ADD CONSTRAINT "BookSeriesEntry_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "Book"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookRelation" ADD CONSTRAINT "BookRelation_sourceBookId_fkey" FOREIGN KEY ("sourceBookId") REFERENCES "Book"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookRelation" ADD CONSTRAINT "BookRelation_targetBookId_fkey" FOREIGN KEY ("targetBookId") REFERENCES "Book"("id") ON DELETE CASCADE ON UPDATE CASCADE;
