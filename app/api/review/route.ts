/**
 * API route for the review queue.
 * GET  /api/review — List pending review items
 * POST /api/review — Approve/reject/correct a review item
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") || "pending";
    const limit = parseInt(searchParams.get("limit") || "20");
    const page = parseInt(searchParams.get("page") || "1");

    const [items, total] = await Promise.all([
      prisma.reviewItem.findMany({
        where: { status },
        include: {
          adCapture: {
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
            },
          },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.reviewItem.count({ where: { status } }),
    ]);

    return NextResponse.json({
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error("[Review API] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal error" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { reviewItemId, action, corrections } = body;

    if (!reviewItemId || !action) {
      return NextResponse.json(
        { error: "Missing reviewItemId or action" },
        { status: 400 }
      );
    }

    if (!["approved", "rejected", "corrected"].includes(action)) {
      return NextResponse.json(
        { error: "Invalid action. Must be: approved, rejected, or corrected" },
        { status: 400 }
      );
    }

    // Update review item
    const reviewItem = await prisma.reviewItem.update({
      where: { id: reviewItemId },
      data: {
        status: action,
        corrections: corrections || null,
        reviewedAt: new Date(),
      },
      include: { adCapture: true },
    });

    // Update the ad capture's review status
    await prisma.adCapture.update({
      where: { id: reviewItem.adCaptureId },
      data: {
        reviewStatus: action === "rejected" ? "rejected" : "approved",
        // Apply corrections if provided
        ...(corrections
          ? {
              brand: corrections.brand || reviewItem.adCapture.brand,
              campaignName: corrections.campaignName || reviewItem.adCapture.campaignName,
              adFormat: corrections.adFormat || reviewItem.adCapture.adFormat,
            }
          : {}),
      },
    });

    // If corrections include brand changes, update the campaign
    if (corrections?.brand && reviewItem.adCapture.campaignId) {
      await prisma.adCampaign.update({
        where: { id: reviewItem.adCapture.campaignId },
        data: { brand: corrections.brand },
      });
    }

    return NextResponse.json({ success: true, reviewItem });
  } catch (error) {
    console.error("[Review API] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal error" },
      { status: 500 }
    );
  }
}
