/**
 * Jina-based capture pipeline.
 * Uses Jina Reader + Gemini text analysis to extract ad metadata without screenshots/OCR.
 */

import { prisma, Prisma } from "@/lib/prisma";
import { saveFile } from "@/lib/storage";
import { getAdapter } from "./adapters";
import { capturePage, closeBrowser } from "./capture";
import { analyzeJinaContent, fetchWithJina } from "./jina";
import { getReviewStatus } from "./confidence";

export interface JinaPipelineResult {
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
 * Run the Jina pipeline for a newspaper on a given date.
 */
export async function runJinaPipeline(
  newspaperSlug: string,
  date: Date
): Promise<JinaPipelineResult> {
  const adapter = getAdapter(newspaperSlug);
  const errors: string[] = [];
  let totalConfidence = 0;
  let adsFound = 0;

  const newspaper =
    (await prisma.newspaper.findUnique({ where: { slug: newspaperSlug } })) ||
    (await prisma.newspaper.create({
      data: {
        name: adapter.name,
        slug: adapter.slug,
        baseUrl: adapter.baseUrl,
        sourceType: "web",
        active: true,
      },
    }));

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

  const logJob = async (level: string, message: string, metadata?: Prisma.InputJsonValue) => {
    console.log(`[${level.toUpperCase()}] ${message}`);
    await prisma.captureJobLog.create({
      data: {
        jobId: job.id,
        level,
        message,
        metadata: metadata ?? undefined,
      },
    });
  };

  await logJob("info", `Starting Jina capture for ${adapter.name}`);

  try {
    const edition = await adapter.discoverEdition(date);
    await logJob("info", `Edition discovered: ${edition.type} at ${edition.url}`);

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

    const sectionUrls = adapter.getSectionUrls();
    for (let i = 0; i < sectionUrls.length; i++) {
      const url = sectionUrls[i];
      const section = adapter.config.sections[i] || "/";

      const currentJob = await prisma.captureJob.findUnique({ where: { id: job.id } });
      if (currentJob?.status === "cancelled") {
        await logJob("warn", "Job cancelled by user");
        return {
          newspaperSlug,
          jobId: job.id,
          adsFound,
          avgConfidence: adsFound > 0 ? totalConfidence / adsFound : 0,
          errors,
          cancelled: true,
        };
      }

      try {
        await logJob("info", `Capturing page screenshot: ${section} (${url})`);
        const captured = await capturePage(url, section, adapter.config);

        const datePath = date.toISOString().split("T")[0];
        const screenshotFilename = `${section.replace(/\//g, "_") || "portrait"}.png`;
        const storageKey = `captures/${newspaperSlug}/${datePath}/${screenshotFilename}`;
        const finalScreenshotKey = await saveFile(storageKey, captured.screenshot);

        await logJob("info", `Jina fetching section: ${section} (${url})`);
        const jina = await fetchWithJina(url);
        const extractedAds = await analyzeJinaContent(jina.content, url);

        await logJob("info", `Jina extracted ${extractedAds.length} ads from ${section}`);

        for (const ad of extractedAds) {
          const reviewStatus = getReviewStatus(ad.confidence);

          const landingDomain = safeDomain(ad.landing_domain);
          const existing = await prisma.adCapture.findFirst({
            where: {
              extractionMethod: "jina",
              platform: newspaperSlug,
              brand: ad.brand,
              product: ad.product,
              landing_domain: landingDomain,
            },
            orderBy: { createdAt: "desc" },
          });

          if (existing) {
            await prisma.adCapture.update({
              where: { id: existing.id },
              data: {
                last_seen: date,
                occurrences: { increment: 1 },
                confidenceScore: Math.max(existing.confidenceScore, ad.confidence),
                reviewStatus,
                source_url: url,
                imageKey: finalScreenshotKey,
              },
            });
          } else {
            await prisma.adCapture.create({
              data: {
                pageId: null,
                campaignId: null,
                captureDate: date,
                imageKey: finalScreenshotKey,
                perceptualHash: null,
                brand: ad.brand,
                product: ad.product,
                campaignName: null,
                cta: ad.cta,
                landing_domain: landingDomain,
                adFormat: ad.format,
                widthPx: null,
                heightPx: null,
                normalizedSize: null,
                ocrText: null,
                confidenceScore: ad.confidence,
                extractionMethod: "jina",
                platform: newspaperSlug,
                source_url: url,
                first_seen: date,
                last_seen: date,
                occurrences: 1,
                rawExtraction: JSON.parse(JSON.stringify({ section, url, jina: { title: jina.title }, ad })),
                reviewStatus,
              },
            });
          }

          adsFound++;
          totalConfidence += ad.confidence;
        }
      } catch (sectionError) {
        const msg = sectionError instanceof Error ? sectionError.message : String(sectionError);
        errors.push(`Section error (${url}): ${msg}`);
        await logJob("error", `Failed Jina section: ${url} - ${msg}`);
      }
    }

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

    await prisma.edition.update({
      where: { id: editionRecord.id },
      data: { status: "processed" },
    });

    await logJob("info", `Jina capture complete: ${adsFound} ads, avg confidence ${avgConfidence.toFixed(2)}`);

    return { newspaperSlug, jobId: job.id, adsFound, avgConfidence, errors };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    await prisma.captureJobLog.create({
      data: { jobId: job.id, level: "error", message: `Jina pipeline failed: ${msg}` },
    });
    await prisma.captureJob.update({
      where: { id: job.id },
      data: { status: "failed", completedAt: new Date() },
    });
    throw error;
  } finally {
    await closeBrowser();
  }
}
