import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isOutstandingInvoiceStatus } from "@/lib/invoice-totals";

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
    const period = searchParams.get("period") || "month";
    const limit = Math.min(50, parseInt(searchParams.get("limit") || "20", 10));
    const offset = parseInt(searchParams.get("offset") || "0", 10);

    const sessionUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    });
    if (!sessionUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let invoiceUserIds = [session.user.id];
    if (sessionUser.role === "TC") {
      const links = await prisma.tCAgentLink.findMany({
        where: { tcUserId: session.user.id },
        select: { agentUserId: true },
      });
      invoiceUserIds = links.map((link) => link.agentUserId);
    }

    const where: any = {
      userId: { in: invoiceUserIds },
      status: { not: "DRAFT" },
    };
    if (status === "DRAFT") {
      return NextResponse.json({ error: "Draft invoices are not available" }, { status: 403 });
    }
    if (status) where.status = status;

    const periodStart = new Date();
    if (period === "day") {
      periodStart.setHours(0, 0, 0, 0);
    } else if (period === "week") {
      periodStart.setDate(periodStart.getDate() - periodStart.getDay());
      periodStart.setHours(0, 0, 0, 0);
    } else if (period === "year" || period === "ytd") {
      periodStart.setMonth(0, 1);
      periodStart.setHours(0, 0, 0, 0);
    } else {
      periodStart.setDate(1);
      periodStart.setHours(0, 0, 0, 0);
    }
    const periodWhere = { ...where, createdAt: { gte: periodStart } };

    const [invoices, total, availableCredits, periodInvoices] = await Promise.all([
      prisma.invoice.findMany({
        where,
        include: {
          user: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
        },
        orderBy: { createdAt: "desc" },
        skip: offset,
        take: limit,
      }),
      prisma.invoice.count({ where }),
      prisma.coupon.findMany({
        where: {
          assignedUserId: { in: invoiceUserIds },
          isCredit: true,
          isActive: true,
          OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
        },
        select: {
          id: true,
          code: true,
          remainingValue: true,
        },
      }),
      prisma.invoice.findMany({
        where: periodWhere,
        select: { amount: true, discountAmount: true, taxAmount: true, status: true },
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
      period,
      stats: {
        paidInvoices: periodInvoices.filter((invoice) => invoice.status === "PAID").length,
        unpaidInvoices: periodInvoices.filter((invoice) => isOutstandingInvoiceStatus(invoice.status)).length,
        averageInvoice: periodInvoices.length > 0
          ? periodInvoices.reduce(
              (sum, invoice) =>
                sum + (invoice.amount || 0) - (invoice.discountAmount || 0) + invoice.taxAmount,
              0
            ) / periodInvoices.length
          : 0,
      },
    });
  } catch (error) {
    console.error("Failed to fetch invoices:", error);
    return NextResponse.json(
      { error: "Failed to fetch invoices" },
      { status: 500 }
    );
  }
}
