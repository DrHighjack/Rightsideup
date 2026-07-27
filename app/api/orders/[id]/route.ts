import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activityLog";

function serializeOrderPhotos<T extends { id: string; photos: unknown }>(order: T) {
  const photos = Array.isArray(order.photos) ? order.photos : [];
  return {
    ...order,
    photos: photos.map((photo: any) => ({
      id: photo.id,
      name: photo.name,
      uploadedAt: photo.uploadedAt,
      url: `/api/orders/${order.id}/photos?photoId=${encodeURIComponent(photo.id)}`,
    })),
  };
}

function parseCalendarDate(value: unknown): Date | null {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T12:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

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
      include: {
        realtor: { select: { id: true, email: true, firstName: true, lastName: true } },
        ticket811: { select: { id: true } },
      },
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

    if ((session.user as any).role === "TC") {
      const link = await prisma.tCAgentLink.findUnique({
        where: {
          tcUserId_agentUserId: {
            tcUserId: session.user.id,
            agentUserId: order.realtorId,
          },
        },
        select: { id: true },
      });

      if (!link) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    return NextResponse.json(serializeOrderPhotos(order));
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

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const role = (session.user as any).role as string;

    const currentOrder = await prisma.order.findUnique({
      where: { id: params.id },
    });

    if (!currentOrder) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    if (role !== "ADMIN") {
      let canReschedule = role === "REALTOR" && currentOrder.realtorId === session.user.id;
      if (role === "TC") {
        const link = await prisma.tCAgentLink.findUnique({
          where: {
            tcUserId_agentUserId: {
              tcUserId: session.user.id,
              agentUserId: currentOrder.realtorId,
            },
          },
          select: { id: true },
        });
        canReschedule = Boolean(link);
      }

      if (!canReschedule) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }

      if (Object.keys(body).some((field) => field !== "scheduledDate")) {
        return NextResponse.json(
          { error: "Only the requested date can be changed" },
          { status: 400 }
        );
      }

      if (!["PENDING", "SCHEDULED", "ON_HOLD"].includes(currentOrder.status)) {
        return NextResponse.json(
          { error: "This order can no longer be rescheduled" },
          { status: 409 }
        );
      }

      const scheduledDate = parseCalendarDate(body.scheduledDate);
      if (!scheduledDate) {
        return NextResponse.json({ error: "Enter a valid requested date" }, { status: 400 });
      }

      const today = new Date();
      const todayUtc = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
      if (scheduledDate.getTime() < todayUtc) {
        return NextResponse.json({ error: "Requested date cannot be in the past" }, { status: 400 });
      }

      const updatedOrder = await prisma.order.update({
        where: { id: params.id },
        data: { scheduledDate },
        include: {
          realtor: { select: { id: true, email: true, firstName: true, lastName: true } },
          ticket811: { select: { id: true } },
        },
      });

      await logActivity({
        userId: session.user.id,
        action: "ORDER_STATUS_CHANGED",
        entityType: "Order",
        entityId: currentOrder.id,
        description: `Changed requested date for order ${currentOrder.orderNumber}`,
        metadata: {
          previousScheduledDate: currentOrder.scheduledDate?.toISOString() ?? null,
          scheduledDate: scheduledDate.toISOString(),
        },
      });

      try {
        const admins = await prisma.user.findMany({
          where: { role: "ADMIN", NOT: { tags: { has: "INACTIVE" } } },
          select: { id: true },
        });
        const formattedDate = new Intl.DateTimeFormat("en-US", { timeZone: "UTC" }).format(
          scheduledDate
        );
        const notifications = admins.map((admin) => ({
          userId: admin.id,
          title: "Order Date Changed",
          message: `${currentOrder.orderNumber} was requested for ${formattedDate}.`,
          type: "ORDER_RESCHEDULED",
          link: `/admin/orders/${currentOrder.id}`,
        }));
        if (session.user.id !== currentOrder.realtorId) {
          notifications.push({
            userId: currentOrder.realtorId,
            title: "Order Date Changed",
            message: `${currentOrder.orderNumber} was requested for ${formattedDate}.`,
            type: "ORDER_RESCHEDULED",
            link: `/dashboard/orders/${currentOrder.id}`,
          });
        }
        await prisma.notification.createMany({
          data: notifications,
        });
      } catch (notificationError) {
        console.error("Failed to create reschedule notifications:", notificationError);
      }

      return NextResponse.json(serializeOrderPhotos(updatedOrder));
    }
    
    // Extract ONLY updatable fields - whitelist approach
    const updateData: any = {};
    
    // Only allow these specific fields to be updated
    const allowedFields = ['status', 'notes', 'adminNotes', 'scheduledDate', 'address', 'addressLat', 'addressLng'];
    
    for (const field of allowedFields) {
      if (field in body && body[field] !== undefined) {
        if (field === 'scheduledDate' && body[field]) {
          updateData.scheduledDate = parseCalendarDate(body[field]) || new Date(body[field]);
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
