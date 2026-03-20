/**
 * API route for triggering ad captures.
 * POST /api/capture — Trigger capture for one or all newspapers
 * GET  /api/capture — Get recent capture jobs
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { runCapturePipeline } from "@/lib/capture/pipeline";
import { getAvailableAdapters } from "@/lib/capture/adapters";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { slug, date: dateStr } = body;

    const date = dateStr ? new Date(dateStr) : new Date();
    date.setHours(0, 0, 0, 0);

    if (slug === "all") {
      // Capture all newspapers in parallel
      const adapters = getAvailableAdapters();
      const results = await Promise.allSettled(
        adapters.map((s) => runCapturePipeline(s, date))
      );

      const summary = results.map((result, i) => ({
        slug: adapters[i],
        status: result.status,
        ...(result.status === "fulfilled"
          ? {
              adsFound: result.value.adsFound,
              avgConfidence: result.value.avgConfidence,
              errors: result.value.errors,
            }
          : { error: result.reason?.message || "Unknown error" }),
      }));

      return NextResponse.json({ success: true, results: summary });
    } else if (slug) {
      // Capture single newspaper
      const result = await runCapturePipeline(slug, date);
      return NextResponse.json({ success: true, result });
    } else {
      return NextResponse.json(
        { error: "Missing 'slug' parameter. Use a newspaper slug or 'all'." },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error("[Capture API] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal error" },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "20");
    const status = searchParams.get("status");

    const jobs = await prisma.captureJob.findMany({
      where: status ? { status } : {},
      include: {
        newspaper: { select: { name: true, slug: true } },
        _count: { select: { logs: true } },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    return NextResponse.json({ jobs });
  } catch (error) {
    console.error("[Capture API] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal error" },
      { status: 500 }
    );
  }
}
