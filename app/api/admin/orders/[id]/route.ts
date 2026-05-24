import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

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
    });

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    const body = await request.json();

    // Prepare update data
    const updateData: any = {
      ...body,
      scheduledDate: body.scheduledDate
        ? new Date(body.scheduledDate)
        : undefined,
    };

    // If status is changing to something other than PENDING, reset stale flags
    if (body.status && body.status !== 'PENDING') {
      updateData.isStale = false;
      updateData.staleAt = null;
    }

    const updatedOrder = await prisma.order.update({
      where: { id: params.id },
      data: updateData,
    });

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
