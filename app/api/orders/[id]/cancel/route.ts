import { NextRequest, NextResponse } from "next/server";
import { getRequestUser } from "@/lib/mobile-auth";
import { prisma } from "@/lib/prisma";

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const requestUser = await getRequestUser(request);

    if (!requestUser?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!["ADMIN", "REALTOR", "TC"].includes(requestUser.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { cancelReason } = body;

    const order = await prisma.order.findUnique({
      where: { id: params.id },
    });

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    // Realtors can only cancel their own orders
    if (
      requestUser.role === "REALTOR" &&
      order.realtorId !== requestUser.id
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (requestUser.role === "TC") {
      const link = await prisma.tCAgentLink.findUnique({
        where: {
          tcUserId_agentUserId: {
            tcUserId: requestUser.id,
            agentUserId: order.realtorId,
          },
        },
        select: { id: true },
      });

      if (!link) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    // Realtors and TCs can cancel before 811 clearance or scheduling begins.
    if (
      ["REALTOR", "TC"].includes(requestUser.role) &&
      !["PENDING", "CONFIRMED"].includes(order.status)
    ) {
      return NextResponse.json(
        { error: "This order can no longer be cancelled online" },
        { status: 400 }
      );
    }

    if (requestUser.role === "REALTOR" || requestUser.role === "TC") {
      const existingTicket = await prisma.ticket811.findFirst({
        where: {
          OR: [
            { orderId: order.id },
            { matchedOrderIds: { has: order.id } },
          ],
        },
        select: { id: true, ticketNumber: true },
      });

      if (existingTicket) {
        return NextResponse.json(
          {
            error:
              "This order already has an 811 ticket. Please contact admin to manage ticket-related cancellations.",
          },
          { status: 409 }
        );
      }
    }

    const updatedOrder = await prisma.order.update({
      where: { id: params.id },
      data: {
        status: "CANCELLED",
        cancelledAt: new Date(),
        cancelReason: cancelReason || null,
      },
    });

    return NextResponse.json({
      ...updatedOrder,
      photos: Array.isArray(updatedOrder.photos) ? updatedOrder.photos : [],
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
