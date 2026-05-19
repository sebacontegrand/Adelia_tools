/**
 * Main capture pipeline orchestrator.
 * Coordinates the full end-to-end capture pipeline for a single newspaper.
 */

import { prisma, Prisma } from "../prisma";
import { saveFile } from "../storage";


import { getAdapter } from "./adapters";
import { capturePage, cropRegion, closeBrowser } from "./capture";
import { analyzeAdImage, normalizeSize } from "./extract";
import { computePerceptualHash, findMostSimilar } from "./dedup";
import { computeConfidence, getReviewStatus, getReviewReason, type ConfidenceFactors } from "./confidence";
import { isGeminiRateLimitError } from "@/lib/ai/gemini";




export interface PipelineResult {
  newspaperSlug: string;
  jobId: string;
  adsFound: number;
  avgConfidence: number;
  errors: string[];
  cancelled?: boolean;
}

function safeDomain(input: string | null): string | null {
  if (!input) return null;
  try {
    const url = input.includes("://") ? new URL(input) : new URL(`https://${input}`);
    return url.hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return input.toLowerCase().trim();
  }
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
  const newspaper =
    (await prisma.newspaper.findUnique({
      where: { slug: newspaperSlug },
    })) ||
    (await prisma.newspaper.create({
      data: {
        name: adapter.name,
        slug: adapter.slug,
        baseUrl: adapter.baseUrl,
        sourceType: "web",
        active: true,
      },
    }));

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

  const skipGemini = process.env.CAPTURE_SKIP_GEMINI === "1" || process.env.CAPTURE_SKIP_GEMINI === "true";
  let geminiRateLimited = false;

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
        const maxRegions = Math.max(1, Number(process.env.MAX_AD_REGIONS_PER_PAGE || "8"));
        const regions = captured.adRegions.slice(0, maxRegions);

        // Create page record
        const datePath = date.toISOString().split("T")[0];
        const screenshotFilename = `${section.replace(/\//g, "_") || "portrait"}.png`;
        const storageKey = `captures/${newspaperSlug}/${datePath}/${screenshotFilename}`;
        const finalScreenshotKey = await saveFile(storageKey, captured.screenshot);



        const pageRecord = await prisma.page.create({
          data: {
            editionId: editionRecord.id,
            pageNumber: i + 1,
            screenshotKey: finalScreenshotKey,

            sourceUrl: url,
            section: section === "/" ? "Portada" : section.replace("/", ""),
            widthPx: captured.widthPx,
            heightPx: captured.heightPx,
          },
        });

        await logJob(
          job.id,
          "info",
          `Page captured: ${captured.widthPx}x${captured.heightPx}, ${captured.adRegions.length} ad regions (processing ${regions.length})`
        );

        // 3. Process each ad region
        for (const region of regions) {
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

            // Compute hash and persist image regardless of AI availability.
            const pHash = await computePerceptualHash(adImage);
            const imageKey = `ads/${newspaperSlug}/${datePath}/${pHash}.png`;
            await saveFile(imageKey, adImage);

            // AI analysis (OCR+extraction) – can be disabled or rate-limited.
            let ocrResult: { text: string; confidence: number; language: string } | null = null;
            let extraction:
              | {
                  brand: string;
                  product: string;
                  campaignName: string;
                  adFormat: string;
                  cta: string | null;
                  price: string | null;
                  url: string | null;
                  phone: string | null;
                  entities: { type: string; value: string; confidence: number }[];
                  confidence: number;
                }
              | null = null;

            if (!skipGemini && !geminiRateLimited) {
              try {
                const analysis = await analyzeAdImage(adImage, {
                  source: adapter.name,
                  section,
                  width: region.width,
                  height: region.height,
                });
                ocrResult = analysis.ocr;
                extraction = analysis.extraction;
              } catch (aiError) {
                if (isGeminiRateLimitError(aiError)) {
                  geminiRateLimited = true;
                  await logJob(job.id, "warn", "Gemini rate-limited; storing remaining captures without AI extraction");
                }
                await logJob(
                  job.id,
                  "warn",
                  `AI analysis failed; storing raw capture (reason: ${aiError instanceof Error ? aiError.message : String(aiError)})`
                );
              }
            }

            const similar = findMostSimilar(pHash, hashList);
            
            let campaignId: string | null = null;
            if (similar && extraction && extraction.brand && extraction.brand !== "Unknown") {
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

            if (!campaignId && extraction && extraction.brand && extraction.brand !== "Unknown") {
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

            // Confidence/review status
            let score = 0;
            let factors: ConfidenceFactors | null = null;
            let reviewStatus: "auto_approved" | "pending" = "pending";
            if (ocrResult && extraction) {
              const computed = computeConfidence(ocrResult, extraction, {
                isKnownCampaign: similar !== null,
                width: region.width,
                height: region.height,
              });
              score = computed.score;
              factors = computed.factors;
              reviewStatus = getReviewStatus(score);
            }

            // 8. Store
            const adCapture = await prisma.adCapture.create({
              data: {
                pageId: pageRecord.id,
                campaignId,
                captureDate: date,
                imageKey,
                perceptualHash: pHash,
                brand: extraction?.brand || "Unknown",
                product: extraction?.product || null,
                campaignName: extraction?.campaignName || null,
                cta: extraction?.cta ?? null,
                landing_domain: safeDomain(extraction?.url ?? null),
                adFormat: extraction?.adFormat ?? null,
                widthPx: region.width,
                heightPx: region.height,
                normalizedSize: normalizeSize(region.width, region.height),
                ocrText: ocrResult?.text || null,
                confidenceScore: score,
                extractionMethod: "screenshot",
                platform: newspaperSlug,
                source_url: url,
                first_seen: date,
                last_seen: date,
                occurrences: 1,
                rawExtraction: JSON.parse(JSON.stringify({
                  ocr: ocrResult,
                  extraction,
                  factors: factors ?? undefined,
                  aiSkipped: skipGemini,
                  aiRateLimited: geminiRateLimited,
                })),
                reviewStatus,
              },
            });

            // Store extracted entities
            if (extraction?.entities) {
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
            }

            // Queue for review if needed
            const reviewReason =
              ocrResult && extraction && factors ? getReviewReason(score, factors) : "ai_unavailable";
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
              `Ad captured: ${extraction?.brand || "Unknown"} - ${extraction?.adFormat || normalizeSize(region.width, region.height)} (confidence: ${score})`
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
