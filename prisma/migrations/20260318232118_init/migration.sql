-- CreateTable
CREATE TABLE "newspapers" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "baseUrl" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL DEFAULT 'web',
    "kioskUrl" TEXT,
    "authConfig" JSONB,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "newspapers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "editions" (
    "id" TEXT NOT NULL,
    "newspaperId" TEXT NOT NULL,
    "editionDate" DATE NOT NULL,
    "editionUrl" TEXT,
    "pdfStorageKey" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "editions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pages" (
    "id" TEXT NOT NULL,
    "editionId" TEXT NOT NULL,
    "pageNumber" INTEGER NOT NULL,
    "screenshotKey" TEXT NOT NULL,
    "sourceUrl" TEXT,
    "section" TEXT,
    "widthPx" INTEGER NOT NULL,
    "heightPx" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ad_captures" (
    "id" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "campaignId" TEXT,
    "captureDate" DATE NOT NULL,
    "imageKey" TEXT NOT NULL,
    "perceptualHash" TEXT,
    "brand" TEXT,
    "campaignName" TEXT,
    "adFormat" TEXT,
    "widthPx" INTEGER NOT NULL,
    "heightPx" INTEGER NOT NULL,
    "normalizedSize" TEXT,
    "ocrText" TEXT,
    "confidenceScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "extractionMethod" TEXT NOT NULL DEFAULT 'screenshot',
    "rawExtraction" JSONB,
    "reviewStatus" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ad_captures_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ad_campaigns" (
    "id" TEXT NOT NULL,
    "brand" TEXT NOT NULL,
    "campaignName" TEXT,
    "firstSeenDate" DATE NOT NULL,
    "lastSeenDate" DATE NOT NULL,
    "totalAppearances" INTEGER NOT NULL DEFAULT 1,
    "representativeImageKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ad_campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "extracted_entities" (
    "id" TEXT NOT NULL,
    "adCaptureId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "extracted_entities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "review_items" (
    "id" TEXT NOT NULL,
    "adCaptureId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "reviewedBy" TEXT,
    "corrections" JSONB,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "review_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "capture_jobs" (
    "id" TEXT NOT NULL,
    "newspaperId" TEXT NOT NULL,
    "targetDate" DATE NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "adsFound" INTEGER NOT NULL DEFAULT 0,
    "adsReviewed" INTEGER NOT NULL DEFAULT 0,
    "avgConfidence" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "capture_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "capture_job_logs" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "level" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "capture_job_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "newspapers_name_key" ON "newspapers"("name");

-- CreateIndex
CREATE UNIQUE INDEX "newspapers_slug_key" ON "newspapers"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "editions_newspaperId_editionDate_key" ON "editions"("newspaperId", "editionDate");

-- CreateIndex
CREATE INDEX "ad_captures_perceptualHash_idx" ON "ad_captures"("perceptualHash");

-- CreateIndex
CREATE INDEX "ad_captures_captureDate_idx" ON "ad_captures"("captureDate");

-- CreateIndex
CREATE INDEX "ad_captures_reviewStatus_idx" ON "ad_captures"("reviewStatus");

-- CreateIndex
CREATE INDEX "ad_captures_brand_idx" ON "ad_captures"("brand");

-- CreateIndex
CREATE INDEX "ad_campaigns_brand_idx" ON "ad_campaigns"("brand");

-- CreateIndex
CREATE INDEX "review_items_status_idx" ON "review_items"("status");

-- CreateIndex
CREATE UNIQUE INDEX "capture_jobs_newspaperId_targetDate_key" ON "capture_jobs"("newspaperId", "targetDate");

-- AddForeignKey
ALTER TABLE "editions" ADD CONSTRAINT "editions_newspaperId_fkey" FOREIGN KEY ("newspaperId") REFERENCES "newspapers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pages" ADD CONSTRAINT "pages_editionId_fkey" FOREIGN KEY ("editionId") REFERENCES "editions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ad_captures" ADD CONSTRAINT "ad_captures_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "pages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ad_captures" ADD CONSTRAINT "ad_captures_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "ad_campaigns"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "extracted_entities" ADD CONSTRAINT "extracted_entities_adCaptureId_fkey" FOREIGN KEY ("adCaptureId") REFERENCES "ad_captures"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_items" ADD CONSTRAINT "review_items_adCaptureId_fkey" FOREIGN KEY ("adCaptureId") REFERENCES "ad_captures"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "capture_jobs" ADD CONSTRAINT "capture_jobs_newspaperId_fkey" FOREIGN KEY ("newspaperId") REFERENCES "newspapers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "capture_job_logs" ADD CONSTRAINT "capture_job_logs_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "capture_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
