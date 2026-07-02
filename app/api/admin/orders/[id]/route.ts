import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activityLog";
import { createNotification } from "@/lib/notifications";
import { ActivityAction } from "@prisma/client";
import { sendEmail, getOrderStatusUpdateEmail } from "@/lib/email";

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();

    if (!session?.user?.id || (session.user as any).role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = params;

    // Try to find by orderNumber first (for routes like /api/admin/orders/SPF-00001)
    let order = await prisma.order.findUnique({
      where: { orderNumber: id },
      include: {
        realtor: {
          select: { id: true, email: true, firstName: true, lastName: true },
        },
        items: {
          include: {
            sign: {
              select: { id: true, signNumber: true, type: true, status: true },
            },
          },
        },
      },
    });

    // If not found, try by database id
    if (!order) {
      order = await prisma.order.findUnique({
        where: { id },
        include: {
          realtor: {
            select: { id: true, email: true, firstName: true, lastName: true },
          },
          items: {
            include: {
              sign: {
                select: { id: true, signNumber: true, type: true, status: true },
              },
            },
          },
        },
      });
    }

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    return NextResponse.json(order);
  } catch (error) {
    console.error("Order fetch error:", error);
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
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const order = await prisma.order.findUnique({
      where: { id: params.id },
      include: {
        realtor: {
          select: { id: true, email: true, firstName: true, lastName: true },
        },
      },
    });

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
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

    // If status is changing to something other than PENDING, reset stale flags
    if (updateData.status && updateData.status !== 'PENDING') {
      updateData.staleAt = null;
    }

    const updatedOrder = await prisma.order.update({
      where: { id: params.id },
      data: updateData,
      include: {
        realtor: {
          select: { id: true, email: true, firstName: true, lastName: true },
        },
        items: {
          include: {
            sign: {
              select: { id: true, signNumber: true, type: true, status: true },
            },
          },
        },
      },
    });

    // Log activity if status changed
    if (body.status && order.status !== body.status) {
      if (session?.user?.id) {
        await logActivity({
          userId: session.user.id,
          action: ActivityAction.ORDER_STATUS_CHANGED,
          entityType: 'Order',
          entityId: order.id,
          description: `Order status changed from ${order.status} to ${body.status}`,
          metadata: {
            orderNumber: order.orderNumber,
            oldStatus: order.status,
            newStatus: body.status,
          },
        });
      }

      // Notify the realtor about the status change
      await createNotification({
        userId: order.realtorId,
        type: 'ORDER_STATUS_CHANGED',
        title: `Order ${order.orderNumber} updated`,
        message: `Your order status has changed from ${order.status} to ${body.status}`,
        link: `/dashboard/orders/${order.id}`,
      });

      try {
        const statusEmail = getOrderStatusUpdateEmail(
          order.realtor.firstName || "there",
          order.orderNumber,
          body.status,
          order.address,
          `${process.env.NEXT_PUBLIC_APP_URL || "https://app.northshoresignco.com"}/dashboard/orders/${order.id}`
        );

        await sendEmail({
          to: order.realtor.email,
          subject: statusEmail.subject,
          html: statusEmail.html,
        });
      } catch (emailError) {
        console.error("Failed to send order status email:", emailError);
      }
    }

    return NextResponse.json(updatedOrder);
  } catch (error) {
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
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();

    if (!body.confirm) {
      return NextResponse.json(
        { error: "Confirmation required" },
        { status: 400 }
      );
    }

    const order = await prisma.order.findUnique({
      where: { id: params.id },
    });

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    await prisma.order.delete({
      where: { id: params.id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
