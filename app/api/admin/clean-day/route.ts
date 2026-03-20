import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { deleteStoragePath } from "@/lib/storage";



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




    // 2. Cleanup physical files from public directory
    const newspapers = await prisma.newspaper.findMany({ select: { slug: true } });
    const datePath = targetDate.toISOString().split("T")[0];

    for (const newspaper of newspapers) {
      await deleteStoragePath(`captures/${newspaper.slug}/${datePath}`);
      await deleteStoragePath(`ads/${newspaper.slug}/${datePath}`);
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
