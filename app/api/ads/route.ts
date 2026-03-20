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
    const sortField = searchParams.get("sortField") || "createdAt";
    const sortOrder = (searchParams.get("sortOrder") as "asc" | "desc") || "desc";
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "50");

    // Build where clause
    const where: Prisma.AdCaptureWhereInput = {};

    if (date) {
      const d = new Date(date);
      d.setHours(0, 0, 0, 0);
      where.captureDate = d;
    }

    if (search) {
      where.OR = [
        { brand: { contains: search, mode: "insensitive" } },
        { campaignName: { contains: search, mode: "insensitive" } },
        { ocrText: { contains: search, mode: "insensitive" } },
      ];
    } else if (brand) {
      where.brand = { contains: brand, mode: "insensitive" };
    }

    if (status) {
      where.reviewStatus = status;
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
