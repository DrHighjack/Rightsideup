import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

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
    const status = searchParams.get("status");
    const userId = searchParams.get("userId");
    const sortBy = searchParams.get("sortBy") || "createdAt";
    const limit = Math.min(100, parseInt(searchParams.get("limit") || "50", 10));
    const offset = parseInt(searchParams.get("offset") || "0", 10);

    const where: any = {};
    if (status) where.status = status;
    if (userId) where.userId = userId;

    const [invoices, total] = await Promise.all([
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
    });
  } catch (error) {
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

    const body = await request.json();
    const { userId, orderId, amount, discountAmount, dueDate } = body;

    if (!userId || !amount) {
      return NextResponse.json(
        { error: "userId and amount are required" },
        { status: 400 }
      );
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
    console.error("Failed to create invoice:", error);
    return NextResponse.json(
      { error: "Failed to create invoice" },
      { status: 500 }
    );
  }
}
