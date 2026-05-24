import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { adminOrderSchema } from "@/lib/schemas";
import { generateOrderNumber } from "@/lib/order-utils";
import { sendOrderConfirmationEmail } from "@/lib/email";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id || (session.user as any).role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const type = searchParams.get("type");
    const realtorId = searchParams.get("realtorId");
    const search = searchParams.get("search");
    const dateFrom = searchParams.get("dateFrom");
    const dateTo = searchParams.get("dateTo");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");

    const where: any = {};

    if (status) where.status = status;
    if (type) where.type = type;
    if (realtorId) where.realtorId = realtorId;

    // Date range filtering
    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) {
        where.createdAt.gte = new Date(dateFrom);
      }
      if (dateTo) {
        const endDate = new Date(dateTo);
        endDate.setHours(23, 59, 59, 999);
        where.createdAt.lte = endDate;
      }
    }

    if (search) {
      where.OR = [
        { orderNumber: { contains: search, mode: "insensitive" } },
        { address: { contains: search, mode: "insensitive" } },
      ];
    }

    const orders = await prisma.order.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: "desc" },
      include: {
        realtor: { select: { id: true, email: true, firstName: true, lastName: true } },
      },
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

    if (!session?.user?.id || (session.user as any).role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    console.log("=== Order Request Body ===");
    console.log(JSON.stringify(body, null, 2));
    
    const parsed = adminOrderSchema.safeParse(body);
    console.log("=== Zod Parse Result ===");
    console.log("Success:", parsed.success);
    if (!parsed.success) {
      console.log("Errors:", JSON.stringify(parsed.error.errors, null, 2));
      return NextResponse.json(
        { error: "Invalid input", details: parsed.error.errors },
        { status: 400 }
      );
    }

    const {
      type,
      address,
      addressLat,
      addressLng,
      scheduledDate,
      notes,
      realtorId,
      status,
      items,
    } = parsed.data;

    // Verify realtor exists
    const realtor = await prisma.user.findUnique({
      where: { id: realtorId },
    });

    if (!realtor) {
      return NextResponse.json({ error: "Realtor not found" }, { status: 404 });
    }

    const orderNumber = await generateOrderNumber();

    const itemsToCreate = items?.map((item) => {
      const itemData: any = {
        quantity: item.quantity || 1,
        isHangingSelf: item.isHangingSelf || false,
        storagePlannedAfter: item.storagePlannedAfter ?? null,
      };

      // Only add signId if provided and not the placeholder
      if (item.signId && item.signId !== "HANGUP_MYSELF") {
        itemData.signId = item.signId;
      } else {
        // Explicitly set to null for hang-up-myself items
        itemData.signId = null;
      }

      return itemData;
    }) || [];

    const order = await prisma.order.create({
      data: {
        orderNumber,
        realtorId,
        type,
        address,
        addressLat: addressLat || null,
        addressLng: addressLng || null,
        scheduledDate: scheduledDate ? new Date(scheduledDate) : null,
        notes: notes || null,
        status: (status as any) || "PENDING",
        items: {
          create: itemsToCreate,
        },
      },
      include: {
        items: {
          include: {
            sign: true,
          },
        },
      },
    });

    // Send confirmation email
    try {
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
    } catch (emailError) {
      console.warn("Failed to send confirmation email:", emailError);
      // Don't fail the order creation if email fails
    }

    return NextResponse.json(order, { status: 201 });
  } catch (error: any) {
    console.error("=== Order Creation Error ===");
    console.error(error);
    
    if (error.name === "ZodError") {
      return NextResponse.json(
        { error: "Invalid input", details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Internal server error", message: error.message },
      { status: 500 }
    );
  }
}
