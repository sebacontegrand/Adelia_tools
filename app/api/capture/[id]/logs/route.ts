import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);

    const limit = Math.min(parseInt(searchParams.get("limit") || "200"), 500);
    const before = searchParams.get("before"); // ISO timestamp for pagination

    const logs = await prisma.captureJobLog.findMany({
      where: {
        jobId: id,
        ...(before ? { createdAt: { lt: new Date(before) } } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    return NextResponse.json({
      jobId: id,
      logs,
      nextBefore: logs.length > 0 ? logs[logs.length - 1].createdAt.toISOString() : null,
    });
  } catch (error) {
    console.error("[Job Logs API] GET Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal error" },
      { status: 500 }
    );
  }
}

