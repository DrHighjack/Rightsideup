import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { notifyRealtorAbout811Confirmed } from "@/lib/notifications";

/**
 * POST /api/admin/811/[id]/assign-order
 * Assign a ticket to an order for scheduling
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();

    if (!session?.user?.id || (session.user as any).role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = params;
    const { orderId } = await request.json();

    if (!orderId) {
      return NextResponse.json(
        { error: "orderId is required" },
        { status: 400 }
      );
    }

    // Find the ticket
    const ticket = await prisma.ticket811.findUnique({
      where: { id },
      include: { realtor: true, order: true },
    });

    if (!ticket) {
      return NextResponse.json(
        { error: "Ticket not found" },
        { status: 404 }
      );
    }

    // Find the order
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { realtor: true },
    });

    if (!order) {
      return NextResponse.json(
        { error: "Order not found" },
        { status: 404 }
      );
    }

    // Update ticket with order assignment
    const updated = await prisma.ticket811.update({
      where: { id },
      data: {
        orderId: orderId,
        status: "ACTIVE",
      },
      include: {
        order: true,
        realtor: true,
      },
    });

    // Send notifications to realtor about location confirmation
    if (ticket.realtorId) {
      await notifyRealtorAbout811Confirmed(
        ticket.realtorId,
        ticket.ticketNumber || "Unknown",
        order.address
      );
    }

    return NextResponse.json({
      success: true,
      ticket: updated,
      message: "Order assigned to 811 ticket and realtor notified",
    });
  } catch (error) {
    console.error("Error assigning order:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
