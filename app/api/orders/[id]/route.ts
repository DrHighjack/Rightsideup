import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const order = await prisma.order.findUnique({
      where: { id: params.id },
      include: { realtor: { select: { id: true, email: true, firstName: true, lastName: true } } },
    });

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    // Realtors can only view their own orders
    if (
      (session.user as any).role === "REALTOR" &&
      order.realtorId !== session.user.id
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    return NextResponse.json(order);
  } catch (error) {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

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
    
    // Extract ONLY updatable fields - whitelist approach
    const updateData: any = {};
    
    // Only allow these specific fields to be updated
    const allowedFields = ['status', 'notes', 'adminNotes', 'scheduledDate', 'address', 'addressLat', 'addressLng'];
    
    for (const field of allowedFields) {
      if (field in body && body[field] !== undefined) {
        if (field === 'scheduledDate' && body[field]) {
          updateData.scheduledDate = new Date(body[field]);
        } else if (field !== 'scheduledDate') {
          updateData[field] = body[field];
        }
      }
    }

    // Validate status is a valid enum value
    if (updateData.status) {
      const validStatuses = ['PENDING', 'SCHEDULED', 'ON_HOLD', 'IN_PROGRESS', 'IN_GROUND', 'COMPLETED', 'CANCELLED'];
      if (!validStatuses.includes(updateData.status)) {
        return NextResponse.json({ error: `Invalid status: ${updateData.status}` }, { status: 400 });
      }
    }

    // Get current order first to verify it exists
    const currentOrder = await prisma.order.findUnique({
      where: { id: params.id },
    });

    if (!currentOrder) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    // Update the order with only allowed fields
    const updatedOrder = await prisma.order.update({
      where: { id: params.id },
      data: updateData,
      include: {
        realtor: { select: { id: true, email: true, firstName: true, lastName: true } },
      },
    });

    return NextResponse.json(updatedOrder);
  } catch (error) {
    console.error("Error updating order:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();

    if (!session?.user?.id || (session.user as any).role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();

    if (!body.confirm) {
      return NextResponse.json({ error: "Must confirm deletion" }, { status: 400 });
    }

    // Delete related records first
    await prisma.orderItem.deleteMany({
      where: { orderId: params.id },
    });

    await prisma.orderDiscount.deleteMany({
      where: { orderId: params.id },
    });

    // Delete the order
    await prisma.order.delete({
      where: { id: params.id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting order:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
