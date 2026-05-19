/*
  Warnings:

  - Made the column `brand` on table `ad_captures` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "ad_captures" DROP CONSTRAINT "ad_captures_pageId_fkey";

-- AlterTable
ALTER TABLE "ad_captures" ADD COLUMN     "cta" TEXT,
ADD COLUMN     "first_seen" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "landing_domain" TEXT,
ADD COLUMN     "last_seen" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "occurrences" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "platform" TEXT,
ADD COLUMN     "product" TEXT,
ADD COLUMN     "source_url" TEXT,
ALTER COLUMN "pageId" DROP NOT NULL,
ALTER COLUMN "imageKey" DROP NOT NULL,
ALTER COLUMN "brand" SET NOT NULL,
ALTER COLUMN "widthPx" DROP NOT NULL,
ALTER COLUMN "heightPx" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "ad_captures_extractionMethod_idx" ON "ad_captures"("extractionMethod");

-- CreateIndex
CREATE INDEX "ad_captures_platform_idx" ON "ad_captures"("platform");

-- CreateIndex
CREATE INDEX "ad_captures_first_seen_last_seen_idx" ON "ad_captures"("first_seen", "last_seen");

-- CreateIndex
CREATE INDEX "ad_captures_landing_domain_idx" ON "ad_captures"("landing_domain");

-- AddForeignKey
ALTER TABLE "ad_captures" ADD CONSTRAINT "ad_captures_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "pages"("id") ON DELETE SET NULL ON UPDATE CASCADE;
