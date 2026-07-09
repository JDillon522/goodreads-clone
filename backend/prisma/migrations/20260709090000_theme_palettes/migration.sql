-- CreateEnum
CREATE TYPE "ThemePaletteMode" AS ENUM ('AUTO_TOP_BOOK', 'CUSTOM_BOOK', 'DEFAULT');

-- AlterTable
ALTER TABLE "UserPreference"
ADD COLUMN "themePaletteMode" "ThemePaletteMode" NOT NULL DEFAULT 'DEFAULT',
ADD COLUMN "themePalette" JSONB,
ADD COLUMN "themePaletteSourceLibraryItemId" UUID,
ADD COLUMN "themePaletteSourceTitle" TEXT,
ADD COLUMN "themePaletteSourceCoverUrl" TEXT,
ADD COLUMN "themePaletteGeneratedAt" TIMESTAMP(3);
