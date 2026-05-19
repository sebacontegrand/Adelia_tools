import { NextRequest, NextResponse } from "next/server";
import { prisma, Prisma } from "@/lib/prisma";

function countId(row: unknown): number {
  if (!row || typeof row !== "object") return 0;
  if (!("_count" in row)) return 0;
  const count = (row as { _count?: unknown })._count;
  if (!count || typeof count !== "object") return 0;
  if (!("id" in count)) return 0;
  const id = (count as { id?: unknown }).id;
  return typeof id === "number" ? id : 0;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const from = searchParams.get("from");
    const to = searchParams.get("to");

    const where: Prisma.AdCaptureWhereInput = { reviewStatus: { in: ["approved", "auto_approved"] } };
    if (from || to) {
      where.first_seen = {};
      if (from) {
        where.first_seen.gte = new Date(from);
      }
      if (to) {
        const toDate = new Date(to);
        toDate.setHours(23, 59, 59, 999);
        where.first_seen.lte = toDate;
      }
    }

    const [byFormat, byBrand, byPlatform, byMethod] = await Promise.all([
      prisma.adCapture.groupBy({
        by: ["adFormat"],
        where,
        _count: { id: true },
      }),
      prisma.adCapture.groupBy({
        by: ["brand"],
        where,
        _count: { id: true },
        orderBy: { _count: { id: "desc" } },
        take: 15,
      }),
      prisma.adCapture.groupBy({
        by: ["platform"],
        where,
        _count: { id: true },
      }),
      prisma.adCapture.groupBy({
        by: ["extractionMethod"],
        where,
        _count: { id: true },
      }),
    ]);

    return NextResponse.json({
      by_format: Object.fromEntries(byFormat.map((g) => [g.adFormat || "unknown", countId(g)])),
      by_brand: byBrand.map((g) => ({ brand: g.brand, count: countId(g) })),
      by_platform: Object.fromEntries(byPlatform.map((g) => [g.platform || "unknown", countId(g)])),
      by_method: Object.fromEntries(byMethod.map((g) => [g.extractionMethod, countId(g)])),
    });
  } catch (error) {
    console.error("[Analytics API] Error:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Query failed" }, { status: 500 });
  }
}
