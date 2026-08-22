import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

async function canAccessInvoice(userId: string, role: string, invoiceUserId: string) {
  if (role === "ADMIN" || userId === invoiceUserId) return true;
  if (role !== "TC") return false;

  const link = await prisma.tCAgentLink.findUnique({
    where: {
      tcUserId_agentUserId: {
        tcUserId: userId,
        agentUserId: invoiceUserId,
      },
    },
    select: { id: true },
  });
  return Boolean(link);
}

/**
 * GET /api/invoices/[id]
 * Get a single invoice for the logged-in realtor
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const invoice = await prisma.invoice.findUnique({
      where: { id: params.id },
      include: { lineItems: true },
    });

    if (!invoice) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }

    if (!(await canAccessInvoice(session.user.id, (session.user as any).role, invoice.userId))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const availableCredits = await prisma.coupon.findMany({
      where: {
        assignedUserId: invoice.userId,
        isCredit: true,
        isActive: true,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      select: {
        id: true,
        code: true,
        remainingValue: true,
      },
    });

    const availableCreditAmount = availableCredits.reduce((sum, credit) => {
      return sum + (credit.remainingValue || 0);
    }, 0);

    return NextResponse.json({
      ...invoice,
      availableCreditAmount,
      availableCredits,
    });
  } catch (error) {
    console.error("Failed to fetch invoice:", error);
    return NextResponse.json(
      { error: "Failed to fetch invoice" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/invoices/[id]
 * Update invoice status (realtors can only mark as viewed)
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { status } = body;

    // Validate that user only marks as VIEWED
    if (status !== "VIEWED") {
      return NextResponse.json(
        { error: "Users can only mark invoices as viewed" },
        { status: 400 }
      );
    }

    const invoice = await prisma.invoice.findUnique({
      where: { id: params.id },
    });

    if (!invoice) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }

    const role = (session.user as any).role;
    if (role === "TC" || (role !== "ADMIN" && invoice.userId !== session.user.id)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (!["SENT", "OVERDUE"].includes(invoice.status)) {
      return NextResponse.json(
        { error: "Invoice cannot be marked viewed from its current status" },
        { status: 409 }
      );
    }

    // Update invoice
    const updatedInvoice = await prisma.invoice.update({
      where: { id: params.id },
      data: { status },
    });

    return NextResponse.json(updatedInvoice);
  } catch (error) {
    console.error("Failed to update invoice:", error);
    return NextResponse.json(
      { error: "Failed to update invoice" },
      { status: 500 }
    );
  }
}
