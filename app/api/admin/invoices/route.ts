import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { adminInvoiceCreateSchema, adminInvoiceListQuerySchema } from "@/lib/schemas";
import { ZodError } from "zod";

/**
 * GET /api/admin/invoices
 * Get all invoices (admin only)
 * Query params:
 * - status: DRAFT | SENT | VIEWED | PAID | VOIDED | OVERDUE
 * - userId: filter by user
 * - sortBy: createdAt | dueDate | amount
 * - limit: number (default 50)
 * - offset: number (default 0)
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id || (session.user as any).role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const parsedQuery = adminInvoiceListQuerySchema.parse({
      status: searchParams.get("status") ?? undefined,
      userId: searchParams.get("userId") ?? undefined,
      sortBy: searchParams.get("sortBy") ?? undefined,
      limit: searchParams.get("limit") ? Number(searchParams.get("limit")) : undefined,
      offset: searchParams.get("offset") ? Number(searchParams.get("offset")) : undefined,
    });

    const { status, userId, sortBy, limit, offset } = parsedQuery;

    const where: any = {};
    const statsWhere: any = {};
    if (status) where.status = status;
    if (userId) {
      where.userId = userId;
      statsWhere.userId = userId;
    }

    const [invoices, total, statsTotal, paidStats, unpaidStats, averageStats] = await Promise.all([
      prisma.invoice.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
            },
          },
        },
        orderBy: { [sortBy]: "desc" },
        skip: offset,
        take: limit,
      }),
      prisma.invoice.count({ where }),
      prisma.invoice.count({ where: statsWhere }),
      prisma.invoice.aggregate({
        where: { ...statsWhere, status: "PAID" },
        _count: true,
        _sum: { paidAmount: true },
      }),
      prisma.invoice.aggregate({
        where: {
          ...statsWhere,
          status: { in: ["DRAFT", "SENT", "VIEWED", "OVERDUE"] },
        },
        _count: true,
        _sum: { amount: true, discountAmount: true, paidAmount: true },
      }),
      prisma.invoice.aggregate({
        where: statsWhere,
        _avg: { amount: true },
      }),
    ]);

    // Transform response to include computed name field
    const transformedInvoices = invoices.map((invoice) => ({
      ...invoice,
      user: {
        ...invoice.user,
        name: `${invoice.user.firstName} ${invoice.user.lastName}`.trim(),
      },
    }));

    return NextResponse.json({
      invoices: transformedInvoices,
      total,
      limit,
      offset,
      hasMore: offset + limit < total,
      stats: {
        totalInvoices: statsTotal,
        amountPaid: paidStats._sum.paidAmount || 0,
        outstandingAmount:
          (unpaidStats._sum.amount || 0) -
          (unpaidStats._sum.discountAmount || 0) -
          (unpaidStats._sum.paidAmount || 0),
        paidInvoices: paidStats._count,
        unpaidInvoices: unpaidStats._count,
        averageInvoice: averageStats._avg.amount || 0,
      },
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: "Invalid input", details: error.flatten() }, { status: 400 });
    }
    console.error("Failed to fetch invoices:", error);
    return NextResponse.json(
      { error: "Failed to fetch invoices" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/invoices
 * Create a new invoice (admin only)
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id || (session.user as any).role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const parsedBody = adminInvoiceCreateSchema.parse(await request.json());
    const { userId, orderId, amount: requestedAmount, discountAmount, dueDate, lineItems } = parsedBody;
    const normalizedLineItems = lineItems?.map((item) => ({
      description: item.description,
      quantity: item.quantity,
      unitAmount: item.unitAmount,
      totalAmount: item.quantity * item.unitAmount,
    }));
    const amount = normalizedLineItems
      ? normalizedLineItems.reduce((sum, item) => sum + item.totalAmount, 0)
      : requestedAmount!;

    if (amount <= 0) {
      return NextResponse.json({ error: "Invoice total must be greater than 0" }, { status: 400 });
    }
    if (discountAmount > amount) {
      return NextResponse.json({ error: "Discount cannot exceed the invoice subtotal" }, { status: 400 });
    }

    // Verify user exists
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    // Generate invoice number
    const invoiceCount = await prisma.invoice.count();
    const invoiceNumber = `INV-${Date.now()}-${invoiceCount + 1}`;

    const invoice = await prisma.invoice.create({
      data: {
        userId,
        orderId,
        invoiceNumber,
        amount,
        discountAmount: discountAmount || 0,
        dueDate: dueDate ? new Date(dueDate) : undefined,
        status: "DRAFT",
        lineItems: {
          create: normalizedLineItems || [{
            description: "Service charge",
            quantity: 1,
            unitAmount: Math.round(amount),
            totalAmount: Math.round(amount),
          }],
        },
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    // Transform response to include computed name field
    const response = {
      ...invoice,
      user: {
        ...invoice.user,
        name: `${invoice.user.firstName} ${invoice.user.lastName}`.trim(),
      },
    };

    return NextResponse.json(response, { status: 201 });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: "Invalid input", details: error.flatten() }, { status: 400 });
    }
    console.error("Failed to create invoice:", error);
    return NextResponse.json(
      { error: "Failed to create invoice" },
      { status: 500 }
    );
  }
}
