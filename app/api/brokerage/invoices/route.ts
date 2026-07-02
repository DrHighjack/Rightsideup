import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

async function getBrokerageIdForSessionUser(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { brokerageId: true },
  });

  return user?.brokerageId || null;
}

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    const role = (session?.user as any)?.role;

    if (!session?.user?.id || role !== "BROKERAGE") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const brokerageId = await getBrokerageIdForSessionUser(session.user.id);
    if (!brokerageId) {
      return NextResponse.json({ error: "No brokerage linked to account" }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const memberId = searchParams.get("memberId");
    const search = searchParams.get("search")?.trim();
    const limit = Math.min(50, parseInt(searchParams.get("limit") || "20", 10));
    const offset = Math.max(0, parseInt(searchParams.get("offset") || "0", 10));

    const baseWhere: any = {
      user: {
        brokerageId,
        role: "REALTOR",
      },
    };

    const where: any = {
      ...baseWhere,
    };

    if (status) {
      where.status = status;
    }

    if (memberId) {
      where.userId = memberId;
    }

    if (search) {
      where.OR = [
        {
          invoiceNumber: {
            contains: search,
            mode: "insensitive" as const,
          },
        },
        {
          user: {
            firstName: {
              contains: search,
              mode: "insensitive" as const,
            },
          },
        },
        {
          user: {
            lastName: {
              contains: search,
              mode: "insensitive" as const,
            },
          },
        },
        {
          user: {
            email: {
              contains: search,
              mode: "insensitive" as const,
            },
          },
        },
      ];
    }

    const [invoices, total, invoiceSummary, overdueCount] = await Promise.all([
      prisma.invoice.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: offset,
        take: limit,
        select: {
          id: true,
          invoiceNumber: true,
          amount: true,
          discountAmount: true,
          paidAmount: true,
          status: true,
          dueDate: true,
          paidAt: true,
          createdAt: true,
          userId: true,
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
      }),
      prisma.invoice.count({ where }),
      prisma.invoice.aggregate({
        where: baseWhere,
        _count: {
          _all: true,
        },
        _sum: {
          amount: true,
          discountAmount: true,
          paidAmount: true,
        },
      }),
      prisma.invoice.count({
        where: {
          ...baseWhere,
          status: "OVERDUE",
        },
      }),
    ]);

    const summary = {
      invoiceCount: invoiceSummary._count._all || 0,
      totalInvoiced: invoiceSummary._sum.amount || 0,
      totalDiscount: invoiceSummary._sum.discountAmount || 0,
      totalPaid: invoiceSummary._sum.paidAmount || 0,
      overdueCount,
    };

    const totalOutstanding = Math.max(
      0,
      summary.totalInvoiced - summary.totalDiscount - summary.totalPaid
    );

    return NextResponse.json({
      invoices,
      total,
      limit,
      offset,
      hasMore: offset + limit < total,
      summary: {
        ...summary,
        totalOutstanding,
      },
    });
  } catch (_error) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
