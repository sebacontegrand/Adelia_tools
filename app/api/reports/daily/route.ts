import { NextRequest, NextResponse } from "next/server";
import { prisma, Prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
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

    const targetDate = new Date(date);
    targetDate.setHours(0, 0, 0, 0);

    // 1. Brand Leaderboard (Top 10 brands)
    const brandLeaderboard = await prisma.adCapture.groupBy({
      by: ["brand"],
      where: { captureDate: targetDate, brand: { not: null } },
      _count: { id: true },
      orderBy: { _count: { id: "desc" } },
      take: 10,
    });

    // 2. Newspaper Breakdown
    const newspaperStats = await prisma.adCapture.groupBy({
      by: ["pageId"],
      where: { captureDate: targetDate },
      _count: { id: true },
    });

    // We need to resolve newspaper names for the stats
    const adsByNewspaper = await prisma.newspaper.findMany({
      include: {
        editions: {
          where: { editionDate: targetDate },
          include: {
            _count: { select: { pages: true } },
            pages: {
              include: {
                _count: { select: { adCaptures: true } },
              },
            },
          },
        },
      },
    });

    const newspaperSummary = adsByNewspaper.map((n) => {
      const edition = n.editions[0];
      const adsCount = edition?.pages.reduce((acc, p) => acc + p._count.adCaptures, 0) || 0;
      return {
        name: n.name,
        slug: n.slug,
        adsFound: adsCount,
        pagesCount: edition?._count.pages || 0,
        status: edition?.status || "missing",
      };
    });

    // 3. Overall Stats
    const totalStats = await prisma.adCapture.aggregate({
      where: { captureDate: targetDate },
      _count: { id: true },
      _avg: { confidenceScore: true },
    });

    return NextResponse.json({
      date: targetDate.toISOString().split("T")[0],
      totalAds: totalStats._count.id,
      avgConfidence: totalStats._avg.confidenceScore 
        ? Math.round(totalStats._avg.confidenceScore * 100) / 100 
        : 0,
      brandLeaderboard: brandLeaderboard.map((b) => ({
        brand: b.brand,
        count: b._count.id,
      })),
      newspaperSummary,
    });
  } catch (error) {
    console.error("[Daily Report API] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal error" },
      { status: 500 }
    );
  }
}
