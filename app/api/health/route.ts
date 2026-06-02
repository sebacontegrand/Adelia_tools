import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const startedAt = Date.now();

  let dbOk = false;
  try {
    await prisma.$queryRaw`SELECT 1`;
    dbOk = true;
  } catch {
    dbOk = false;
  }

  return NextResponse.json({
    ok: dbOk,
    db: dbOk ? "ok" : "error",
    env: {
      GEMINI_API_KEY: Boolean(process.env.GEMINI_API_KEY),
      JINA_API_KEY: Boolean(process.env.JINA_API_KEY),
      BROWSERLESS_API_KEY: Boolean(process.env.BROWSERLESS_API_KEY),
      CRON_SECRET: Boolean(process.env.CRON_SECRET),
      BLOB_READ_WRITE_TOKEN: Boolean(process.env.BLOB_READ_WRITE_TOKEN),
      REDIS_URL: Boolean(process.env.REDIS_URL),
    },
    latencyMs: Date.now() - startedAt,
    timestamp: new Date().toISOString(),
  });
}

