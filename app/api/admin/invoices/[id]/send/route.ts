import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/admin/invoices/[id]/send
 * Send an invoice to the user
 */
export async function POST(
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

    // Update invoice status to SENT
    const updated = await prisma.invoice.update({
      where: { id: params.id },
      data: {
        status: "SENT",
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

    // TODO: Send email notification to user
    // TODO: Create notification record

    const response = {
      success: true,
      message: "Invoice sent successfully",
      invoice: {
        ...updated,
        user: {
          ...updated.user,
          name: `${updated.user.firstName} ${updated.user.lastName}`.trim(),
        },
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Failed to send invoice:", error);
    return NextResponse.json(
      { error: "Failed to send invoice" },
      { status: 500 }
    );
  }
}
