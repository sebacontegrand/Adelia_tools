import { NextRequest, NextResponse } from "next/server";
import { prisma, Prisma } from "@/lib/prisma";
import fs from "fs/promises";
import path from "path";

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const dateStr = searchParams.get("date");

    if (!dateStr) {
      return NextResponse.json({ error: "Date parameter is required (YYYY-MM-DD)" }, { status: 400 });
    }

    const date = new Date(dateStr);
    if (isNaN(date.getTime())) {
      return NextResponse.json({ error: "Invalid date format" }, { status: 400 });
    }

    // Set exactly to start of day for DB matching
    const targetDate = new Date(date);
    targetDate.setHours(0, 0, 0, 0);

    console.log(`[Admin] Cleaning day: ${targetDate.toISOString()}`);

    // 1. Get all editions for this day across all newspapers
    const editions = await prisma.edition.findMany({
      where: { editionDate: targetDate },
      include: { newspaper: true },
    });

    // 2. Cleanup physical files from public directory
    const newspapers = await prisma.newspaper.findMany({ select: { slug: true } });
    const datePath = targetDate.toISOString().split("T")[0];

    for (const newspaper of newspapers) {
      const captureDir = path.join(process.cwd(), "public", "captures", newspaper.slug, datePath);
      const adsDir = path.join(process.cwd(), "public", "ads", newspaper.slug, datePath);

      try {
        await fs.rm(captureDir, { recursive: true, force: true });
        console.log(`[Admin] Deleted captures dir: ${captureDir}`);
      } catch (e) {
        console.warn(`[Admin] Could not delete captures dir: ${captureDir}`, e);
      }

      try {
        await fs.rm(adsDir, { recursive: true, force: true });
        console.log(`[Admin] Deleted ads dir: ${adsDir}`);
      } catch (e) {
        console.warn(`[Admin] Could not delete ads dir: ${adsDir}`, e);
      }
    }

    // 3. Delete DB records (cascading deletes will handle nested items)
    // Delete Editions (cascades to Page -> AdCapture -> etc)
    const editionDeleteResult = await prisma.edition.deleteMany({
      where: { editionDate: targetDate },
    });

    // Delete CaptureJobs (cascades to CaptureJobLog)
    const jobDeleteResult = await prisma.captureJob.deleteMany({
      where: { targetDate: targetDate },
    });

    return NextResponse.json({
      message: `Cleaned day ${datePath}`,
      summary: {
        editionsDeleted: editionDeleteResult.count,
        jobsDeleted: jobDeleteResult.count,
        date: datePath,
      },
    });
  } catch (error) {
    console.error("[Admin Clean Day] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal error" },
      { status: 500 }
    );
  }
}
