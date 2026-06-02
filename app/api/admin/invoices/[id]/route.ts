import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/admin/invoices/[id]
 * Get a specific invoice
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();
    if (!session?.user?.id || (session.user as any).role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const invoice = await prisma.invoice.findUnique({
      where: { id: params.id },
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

    if (!invoice) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }

    // Transform response to include computed name field
    const response = {
      ...invoice,
      user: {
        ...invoice.user,
        name: `${invoice.user.firstName} ${invoice.user.lastName}`.trim(),
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Failed to fetch invoice:", error);
    return NextResponse.json(
      { error: "Failed to fetch invoice" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/admin/invoices/[id]
 * Update an invoice
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();
    if (!session?.user?.id || (session.user as any).role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const {
      status,
      amount,
      discountAmount,
      dueDate,
      paidAmount,
      paidAt,
    } = body;

    const updateData: any = {};
    if (status) updateData.status = status;
    if (amount) updateData.amount = amount;
    if (discountAmount !== undefined) updateData.discountAmount = discountAmount;
    if (dueDate) updateData.dueDate = new Date(dueDate);
    if (paidAmount !== undefined) updateData.paidAmount = paidAmount;
    if (paidAt) updateData.paidAt = new Date(paidAt);

    const invoice = await prisma.invoice.update({
      where: { id: params.id },
      data: updateData,
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

    return NextResponse.json(response);
  } catch (error) {
    console.error("Failed to update invoice:", error);
    return NextResponse.json(
      { error: "Failed to update invoice" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/invoices/[id]
 * Delete an invoice (only if DRAFT)
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();
    if (!session?.user?.id || (session.user as any).role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const invoice = await prisma.invoice.findUnique({
      where: { id: params.id },
    });

    if (!invoice) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }

    if (invoice.status !== "DRAFT") {
      return NextResponse.json(
        { error: "Can only delete DRAFT invoices" },
        { status: 400 }
      );
    }

    await prisma.invoice.delete({ where: { id: params.id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete invoice:", error);
    return NextResponse.json(
      { error: "Failed to delete invoice" },
      { status: 500 }
    );
  }
}
