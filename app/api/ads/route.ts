/**
 * API route for listing and searching captured ads.
 * GET /api/ads — List ads with filtering
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma, Prisma } from "@/lib/prisma";


export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get("date");
    const brand = searchParams.get("brand");
    const newspaper = searchParams.get("newspaper");
    const status = searchParams.get("status");
    const search = searchParams.get("search");
    const platform = searchParams.get("platform"); // NEW: Filter by platform
    const format = searchParams.get("format"); // NEW: Filter by ad format
    const landingDomain = searchParams.get("landing_domain"); // NEW: Filter by landing domain
    const from = searchParams.get("from"); // NEW: Start date (YYYY-MM-DD)
    const to = searchParams.get("to"); // NEW: End date (YYYY-MM-DD)
    const sortField = searchParams.get("sortField") || "first_seen";
    const sortOrder = (searchParams.get("sortOrder") as "asc" | "desc") || "desc";
    const page = parseInt(searchParams.get("page") || "1");
    const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 200);

    // Build where clause
    const where: Prisma.AdCaptureWhereInput = {};

    // Legacy support: captureDate
    if (date) {
      const d = new Date(date);
      d.setHours(0, 0, 0, 0);
      where.captureDate = d;
    }

    // NEW: Date range filtering using first_seen
    if (from || to) {
      where.first_seen = {};
      if (from) {
        const fromDate = new Date(from);
        where.first_seen.gte = fromDate;
      }
      if (to) {
        const toDate = new Date(to);
        toDate.setHours(23, 59, 59, 999);
        where.first_seen.lte = toDate;
      }
    }

    if (search) {
      where.OR = [
        { brand: { contains: search, mode: "insensitive" } },
        { product: { contains: search, mode: "insensitive" } },
        { campaignName: { contains: search, mode: "insensitive" } },
        { ocrText: { contains: search, mode: "insensitive" } },
        { cta: { contains: search, mode: "insensitive" } },
      ];
    } else if (brand) {
      where.brand = { contains: brand, mode: "insensitive" };
    }

    if (status) {
      where.reviewStatus = status;
    }

    // NEW: Platform filter
    if (platform) {
      where.platform = { contains: platform, mode: "insensitive" };
    }

    // NEW: Format filter
    if (format) {
      where.adFormat = format;
    }

    // NEW: Landing domain filter
    if (landingDomain) {
      where.landing_domain = { contains: landingDomain, mode: "insensitive" };
    }

    if (newspaper) {
      where.page = {
        edition: {
          newspaper: { slug: newspaper },
        },
      };
    }

    // Build orderBy
    let orderBy: Prisma.AdCaptureOrderByWithRelationInput;
    if (sortField === "newspaper") {
      orderBy = { page: { edition: { newspaper: { name: sortOrder } } } };
    } else if (sortField === "section") {
      orderBy = { page: { section: sortOrder } };
    } else {
      orderBy = { [sortField]: sortOrder };
    }

    const [ads, total] = await Promise.all([
      prisma.adCapture.findMany({
        where,
        include: {
          page: {
            include: {
              edition: {
                include: {
                  newspaper: { select: { name: true, slug: true } },
                },
              },
            },
          },
          campaign: { select: { brand: true, campaignName: true, totalAppearances: true } },
          _count: { select: { reviewItems: true } },
        },
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.adCapture.count({ where }),
    ]);

    // Get summary stats
    const stats = await prisma.adCapture.aggregate({
      where,
      _avg: { confidenceScore: true },
      _count: true,
    });

    return NextResponse.json({
      ads,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      stats: {
        totalAds: stats._count,
        avgConfidence: stats._avg.confidenceScore
          ? Math.round(stats._avg.confidenceScore * 100) / 100
          : 0,
      },
    });
  } catch (error) {
    console.error("[Ads API] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal error" },
      { status: 500 }
    );
  }
}
