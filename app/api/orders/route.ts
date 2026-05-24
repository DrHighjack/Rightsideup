import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { orderSchema } from "@/lib/schemas";
import { prisma } from "@/lib/prisma";
import { generateOrderNumber } from "@/lib/order-utils";
import { sendOrderConfirmationEmail } from "@/lib/email";
import { notifyOrderUpdate } from "@/lib/notifications";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const type = searchParams.get("type");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");

    const where: any = {};
    
    if ((session.user as any).role === "REALTOR") {
      where.realtorId = session.user.id;
    }
    
    if (status) where.status = status;
    if (type) where.type = type;

    const orders = await prisma.order.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: "desc" },
    });

    const total = await prisma.order.count({ where });

    return NextResponse.json({
      orders,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { type, address, addressLat, addressLng, scheduledDate, notes } =
      orderSchema.parse(body);

    const orderNumber = await generateOrderNumber();

    const order = await prisma.order.create({
      data: {
        orderNumber,
        realtorId: session.user.id,
        type,
        address,
        addressLat: addressLat || null,
        addressLng: addressLng || null,
        scheduledDate: scheduledDate ? new Date(scheduledDate) : null,
        notes: notes || null,
      },
    });

    // Send confirmation email
    // Email sending temporarily disabled due to Resend/react-email version conflict
    try {
      const realtor = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { email: true, firstName: true, lastName: true, phone: true },
      });

      if (realtor) {
        await sendOrderConfirmationEmail(
          realtor.email,
          `${realtor.firstName} ${realtor.lastName}`,
          orderNumber,
          {
            type,
            address,
            scheduledDate: scheduledDate || undefined,
            notes: notes || undefined,
          }
        );

        // Send SMS notification
        if (realtor.phone) {
          await notifyOrderUpdate(order.id, "ORDER_CREATED", {
            orderNumber,
            address,
            scheduledDate: scheduledDate ? new Date(scheduledDate).toLocaleDateString() : "TBD",
          }).catch((err) => {
            console.error("Failed to send SMS notification:", err);
            // Don't fail order creation if SMS fails
          });
        }
      }
    } catch (emailError) {
      console.error("Failed to send confirmation email:", emailError);
      // Don't fail the order creation if email fails
    }

    return NextResponse.json(order, { status: 201 });
  } catch (error: any) {
    if (error.name === "ZodError") {
      return NextResponse.json(
        { error: "Invalid input", details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
