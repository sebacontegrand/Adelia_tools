/**
 * Main capture pipeline orchestrator.
 * Coordinates the full end-to-end capture pipeline for a single newspaper.
 */

import { Prisma } from "@prisma/client";
import { prisma } from "../prisma";
import { getAdapter } from "./adapters";
import { capturePage, cropRegion, closeBrowser } from "./capture";
import { performOcr } from "./ocr";
import { extractAdMetadata, normalizeSize } from "./extract";
import { computePerceptualHash, findMostSimilar } from "./dedup";
import { computeConfidence, getReviewStatus, getReviewReason } from "./confidence";
import * as fs from "fs/promises";
import * as path from "path";

export interface PipelineResult {
  newspaperSlug: string;
  jobId: string;
  adsFound: number;
  avgConfidence: number;
  errors: string[];
  cancelled?: boolean;
}

/**
 * Run the full capture pipeline for a newspaper on a given date.
 */
export async function runCapturePipeline(
  newspaperSlug: string,
  date: Date
): Promise<PipelineResult> {
  const adapter = getAdapter(newspaperSlug);
  const errors: string[] = [];
  let totalConfidence = 0;
  let adsFound = 0;

  // Find the newspaper in DB
  const newspaper = await prisma.newspaper.findUnique({
    where: { slug: newspaperSlug },
  });
  if (!newspaper) throw new Error(`Newspaper not found: ${newspaperSlug}`);

  // Create capture job
  const job = await prisma.captureJob.upsert({
    where: {
      newspaperId_targetDate: {
        newspaperId: newspaper.id,
        targetDate: date,
      },
    },
    update: { status: "running", startedAt: new Date() },
    create: {
      newspaperId: newspaper.id,
      targetDate: date,
      status: "running",
      startedAt: new Date(),
    },
  });

  await logJob(job.id, "info", `Starting capture for ${adapter.name}`);

  try {
    // 1. Discover edition
    const edition = await adapter.discoverEdition(date);
    await logJob(job.id, "info", `Edition discovered: ${edition.type} at ${edition.url}`);

    // Create edition record
    const editionRecord = await prisma.edition.upsert({
      where: {
        newspaperId_editionDate: {
          newspaperId: newspaper.id,
          editionDate: date,
        },
      },
      update: { status: "captured", editionUrl: edition.url },
      create: {
        newspaperId: newspaper.id,
        editionDate: date,
        editionUrl: edition.url,
        status: "captured",
      },
    });

    // 2. Capture pages
    const sectionUrls = adapter.getSectionUrls();
    
    // Fetch existing hashes for dedup
    const existingHashes = await prisma.adCapture.findMany({
      where: { perceptualHash: { not: null } },
      select: { id: true, perceptualHash: true, campaignId: true },
      orderBy: { createdAt: "desc" },
      take: 1000,
    });
    const hashList = existingHashes
      .filter((h: { id: string; perceptualHash: string | null; campaignId: string | null }) => h.perceptualHash)
      .map((h: { id: string; perceptualHash: string | null; campaignId: string | null }) => ({ id: h.id, hash: h.perceptualHash! }));

    for (let i = 0; i < sectionUrls.length; i++) {
      const url = sectionUrls[i];
      const section = adapter.config.sections[i] || "/";

      // Check for cancellation
      const currentJob = await prisma.captureJob.findUnique({ where: { id: job.id } });
      if (currentJob?.status === "cancelled") {
        await logJob(job.id, "warn", "Job cancelled by user");
        return { newspaperSlug, jobId: job.id, adsFound, avgConfidence: adsFound > 0 ? totalConfidence / adsFound : 0, errors, cancelled: true };
      }

      try {
        await logJob(job.id, "info", `Capturing section: ${section} (${url})`);
        
        const captured = await capturePage(url, section, adapter.config);

        // Create page record
        const datePath = date.toISOString().split("T")[0];
        const screenshotFilename = `${section.replace(/\//g, "_") || "portrait"}.png`;
        const storagePath = path.join(process.cwd(), "public", "captures", newspaperSlug, datePath);
        const storageKey = `captures/${newspaperSlug}/${datePath}/${screenshotFilename}`;

        // Ensure directory exists
        console.log(`[STORAGE] Saving page to: ${path.join(storagePath, screenshotFilename)}`);
        await fs.mkdir(storagePath, { recursive: true });
        await fs.writeFile(path.join(storagePath, screenshotFilename), captured.screenshot);

        const pageRecord = await prisma.page.create({
          data: {
            editionId: editionRecord.id,
            pageNumber: i + 1,
            screenshotKey: storageKey,
            sourceUrl: url,
            section: section === "/" ? "Portada" : section.replace("/", ""),
            widthPx: captured.widthPx,
            heightPx: captured.heightPx,
          },
        });

        await logJob(
          job.id,
          "info",
          `Page captured: ${captured.widthPx}x${captured.heightPx}, ${captured.adRegions.length} ad regions`
        );

        // 3. Process each ad region
        for (const region of captured.adRegions) {
          // Check for cancellation within ad region loop too
          if (adsFound % 5 === 0) { // Check every 5 ads to avoid too many DB calls
            const jobCheck = await prisma.captureJob.findUnique({ where: { id: job.id } });
            if (jobCheck?.status === "cancelled") {
              await logJob(job.id, "warn", "Job cancelled by user during region processing");
              return { newspaperSlug, jobId: job.id, adsFound, avgConfidence: adsFound > 0 ? totalConfidence / adsFound : 0, errors, cancelled: true };
            }
          }

          try {
            // Crop ad image
            const adImage = await cropRegion(captured.screenshot, region);

            // 4. OCR
            const ocrResult = await performOcr(adImage);

            // 5. Structured extraction
            const extraction = await extractAdMetadata(ocrResult.text, adImage, {
              source: adapter.name,
              section,
              width: region.width,
              height: region.height,
            });

            // 6. Perceptual hash & dedup
            const pHash = await computePerceptualHash(adImage);
            const similar = findMostSimilar(pHash, hashList);
            
            let campaignId: string | null = null;
            if (similar) {
              // Link to existing campaign
              const existingAd = existingHashes.find((h: { id: string; perceptualHash: string | null; campaignId: string | null }) => h.id === similar.id);
              campaignId = existingAd?.campaignId || null;
              
              if (campaignId) {
                await prisma.adCampaign.update({
                  where: { id: campaignId },
                  data: {
                    lastSeenDate: date,
                    totalAppearances: { increment: 1 },
                  },
                });
              }
            }

            if (!campaignId) {
              // Create new campaign
              const campaign = await prisma.adCampaign.create({
                data: {
                  brand: extraction.brand,
                  campaignName: extraction.campaignName || null,
                  firstSeenDate: date,
                  lastSeenDate: date,
                  totalAppearances: 1,
                  representativeImageKey: `ads/${newspaperSlug}/${date.toISOString().split("T")[0]}/${pHash}.png`,
                },
              });
              campaignId = campaign.id;
            }

            // 7. Confidence scoring
            const { score, factors } = computeConfidence(ocrResult, extraction, {
              isKnownCampaign: similar !== null,
              width: region.width,
              height: region.height,
            });

            const reviewStatus = getReviewStatus(score);
            const adDir = path.join(process.cwd(), "public", "ads", newspaperSlug, datePath);
            const adFilename = `${pHash}.png`;
            const imageKey = `ads/${newspaperSlug}/${datePath}/${adFilename}`;

            // Ensure directory exists and save ad crop
            await fs.mkdir(adDir, { recursive: true });
            await fs.writeFile(path.join(adDir, adFilename), adImage);

            // 8. Store
            const adCapture = await prisma.adCapture.create({
              data: {
                pageId: pageRecord.id,
                campaignId,
                captureDate: date,
                imageKey,
                perceptualHash: pHash,
                brand: extraction.brand,
                campaignName: extraction.campaignName || null,
                adFormat: extraction.adFormat,
                widthPx: region.width,
                heightPx: region.height,
                normalizedSize: normalizeSize(region.width, region.height),
                ocrText: ocrResult.text,
                confidenceScore: score,
                extractionMethod: "screenshot",
                rawExtraction: JSON.parse(JSON.stringify({
                  ocr: ocrResult,
                  extraction,
                  factors,
                })),
                reviewStatus,
              },
            });

            // Store extracted entities
            for (const entity of extraction.entities) {
              await prisma.extractedEntity.create({
                data: {
                  adCaptureId: adCapture.id,
                  entityType: entity.type,
                  value: entity.value,
                  confidence: entity.confidence,
                },
              });
            }

            // Queue for review if needed
            const reviewReason = getReviewReason(score, factors);
            if (reviewReason) {
              await prisma.reviewItem.create({
                data: {
                  adCaptureId: adCapture.id,
                  reason: reviewReason,
                  status: "pending",
                },
              });
            }

            // Add hash to dedup list for this session
            hashList.push({ id: adCapture.id, hash: pHash });
            adsFound++;
            totalConfidence += score;

            await logJob(
              job.id,
              "info",
              `Ad captured: ${extraction.brand} - ${extraction.adFormat} (confidence: ${score})`
            );
          } catch (adError) {
            const msg = adError instanceof Error ? adError.message : String(adError);
            errors.push(`Ad region error: ${msg}`);
            await logJob(job.id, "warn", `Failed to process ad region: ${msg}`);
          }
        }
      } catch (pageError) {
        const msg = pageError instanceof Error ? pageError.message : String(pageError);
        errors.push(`Page error (${url}): ${msg}`);
        await logJob(job.id, "error", `Failed to capture page: ${url} - ${msg}`);
      }
    }

    // Update job status
    const avgConfidence = adsFound > 0 ? totalConfidence / adsFound : 0;
    await prisma.captureJob.update({
      where: { id: job.id },
      data: {
        status: "completed",
        adsFound,
        avgConfidence: Math.round(avgConfidence * 100) / 100,
        completedAt: new Date(),
      },
    });

    // Update edition status
    await prisma.edition.update({
      where: { id: editionRecord.id },
      data: { status: "processed" },
    });

    await logJob(job.id, "info", `Capture complete: ${adsFound} ads, avg confidence ${avgConfidence.toFixed(2)}`);

    return { newspaperSlug, jobId: job.id, adsFound, avgConfidence, errors };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    await logJob(job.id, "error", `Pipeline failed: ${msg}`);
    await prisma.captureJob.update({
      where: { id: job.id },
      data: { status: "failed", completedAt: new Date() },
    });
    throw error;
  } finally {
    await closeBrowser();
  }
}

async function logJob(jobId: string, level: string, message: string, metadata?: Prisma.InputJsonValue) {
  console.log(`[${level.toUpperCase()}] ${message}`);
  await prisma.captureJobLog.create({
    data: { jobId, level, message, metadata: metadata ?? undefined },
  });
}
