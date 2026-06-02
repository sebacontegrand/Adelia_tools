import { NextRequest, NextResponse } from "next/server";
import { Queue } from "bullmq";
import { prisma } from "@/lib/prisma";
import { runCapturePipeline } from "@/lib/capture/pipeline";
import { runJinaPipeline } from "@/lib/capture/pipeline-jina";

function getRedisConnection() {
  const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";
  const parsed = new URL(redisUrl);
  const usesTls = parsed.protocol === "rediss:";

  return {
    host: parsed.hostname,
    port: parsed.port ? Number(parsed.port) : 6379,
    username: parsed.username || undefined,
    password: parsed.password || undefined,
    db: parsed.pathname && parsed.pathname.length > 1 ? Number(parsed.pathname.slice(1)) : undefined,
    ...(usesTls ? { tls: {} } : {}),
  };
}

let _scrapeQueue: Queue | null = null;
function getQueue() {
  if (!_scrapeQueue) {
    _scrapeQueue = new Queue("daily-scrape", { connection: getRedisConnection() });
  }
  return _scrapeQueue;
}

export const maxDuration = 60;

async function runWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<R>
): Promise<PromiseSettledResult<R>[]> {
  const results: PromiseSettledResult<R>[] = [];
  let cursor = 0;

  const workers = Array.from({ length: Math.max(1, concurrency) }, async () => {
    while (cursor < items.length) {
      const index = cursor++;
      try {
        const value = await fn(items[index]);
        results[index] = { status: "fulfilled", value };
      } catch (reason) {
        results[index] = { status: "rejected", reason };
      }
    }
  });

  await Promise.all(workers);
  return results;
}

/**
 * GET /api/cron/daily-scrape
 * Triggered by Vercel Cron (0 9 * * * = 09:00 UTC daily)
 * Queues scraping jobs for all active newspapers
 */
export async function GET(req: NextRequest) {
  // Verify Vercel cron secret
  const authHeader = req.headers.get("authorization");
  const expectedToken = `Bearer ${process.env.CRON_SECRET}`;

  if (!process.env.CRON_SECRET || authHeader !== expectedToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    console.log("[Cron] Daily scrape started at", new Date().toISOString());

    const { searchParams } = new URL(req.url);
    const mode = searchParams.get("mode") || "run"; // run | queue
    const method = searchParams.get("method") || "screenshot"; // jina | screenshot
    const dateStr = searchParams.get("date");

    // Get all active newspapers
    const newspapers = await prisma.newspaper.findMany({
      where: { active: true },
      select: { id: true, name: true, slug: true, baseUrl: true },
    });

    if (newspapers.length === 0) {
      console.log("[Cron] No active newspapers to scrape");
      return NextResponse.json({
        status: "completed",
        message: "No active newspapers",
        count: 0,
        timestamp: new Date().toISOString(),
      });
    }

    const date = dateStr ? new Date(dateStr) : new Date();
    date.setHours(0, 0, 0, 0);

    if (mode === "queue") {
      const jobs = [];
      for (const newspaper of newspapers) {
        try {
          const job = await getQueue().add(
            "scrape-newspaper",
            {
              newspaperId: newspaper.id,
              baseUrl: newspaper.baseUrl,
              name: newspaper.name,
              slug: newspaper.slug,
              method,
              targetDate: date.toISOString().split("T")[0],
            },
            {
              attempts: 3,
              backoff: { type: "exponential", delay: 2000 },
              removeOnComplete: { age: 3600 }, // Keep for 1 hour
              removeOnFail: { age: 86400 }, // Keep for 24 hours
            }
          );

          jobs.push({
            newspaperId: newspaper.id,
            slug: newspaper.slug,
            name: newspaper.name,
            jobId: job.id,
          });
        } catch (error) {
          console.error(`[Cron] Failed to queue ${newspaper.name}:`, error);
        }
      }

      return NextResponse.json({
        status: "queued",
        count: jobs.length,
        jobs,
        timestamp: new Date().toISOString(),
      });
    }

    const runner = method === "screenshot" ? runCapturePipeline : runJinaPipeline;
    const slugs = newspapers.map((n) => n.slug);

    const results = await runWithConcurrency(slugs, 2, async (slug) => runner(slug, date));

    const summary = results.map((result, i) => ({
      slug: slugs[i],
      method: method === "screenshot" ? "screenshot" : "jina",
      status: result.status,
      ...(result.status === "fulfilled"
        ? {
            jobId: result.value.jobId,
            adsFound: result.value.adsFound,
            avgConfidence: result.value.avgConfidence,
            errors: result.value.errors,
            cancelled: result.value.cancelled || false,
          }
        : { error: result.reason?.message || String(result.reason || "Unknown error") }),
    }));

    return NextResponse.json({
      status: "completed",
      count: summary.length,
      date: date.toISOString().split("T")[0],
      results: summary,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[Cron] Error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
