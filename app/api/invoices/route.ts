import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/invoices
 * Get invoices for the logged-in realtor
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const limit = Math.min(50, parseInt(searchParams.get("limit") || "20", 10));
    const offset = parseInt(searchParams.get("offset") || "0", 10);

    const where: any = {
      userId: session.user.id,
    };
    if (status) where.status = status;

    const [invoices, total, availableCredits] = await Promise.all([
      prisma.invoice.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: offset,
        take: limit,
      }),
      prisma.invoice.count({ where }),
      prisma.coupon.findMany({
        where: {
          assignedUserId: session.user.id,
          isCredit: true,
          isActive: true,
        },
        select: {
          id: true,
          code: true,
          remainingValue: true,
        },
      }),
    ]);

    const availableCreditAmount = availableCredits.reduce((sum, credit) => {
      return sum + (credit.remainingValue || 0);
    }, 0);

    return NextResponse.json({
      invoices,
      total,
      limit,
      offset,
      hasMore: offset + limit < total,
      availableCreditAmount,
      availableCredits,
    });
  } catch (error) {
    console.error("Failed to fetch invoices:", error);
    return NextResponse.json(
      { error: "Failed to fetch invoices" },
      { status: 500 }
    );
  }
}
