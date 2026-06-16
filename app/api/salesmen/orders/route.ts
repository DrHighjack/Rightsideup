import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { adminOrderSchema } from "@/lib/schemas";
import { generateOrderNumber } from "@/lib/order-utils";
import { sendOrderConfirmationEmail } from "@/lib/email";

/**
 * POST /api/salesmen/orders
 * Create an order for one of the salesman's clients
 * Salesmen can only create orders for clients they've added
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id || !["ADMIN", "SALESMEN"].includes((session.user as any).role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const parsed = adminOrderSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parsed.error.errors },
        { status: 400 }
      );
    }

    const { type, address, addressLat, addressLng, scheduledDate, notes, realtorId, status, items } = parsed.data;
    const userRole = (session.user as any).role;

    // Verify realtor exists
    const realtor = await prisma.user.findUnique({
      where: { id: realtorId },
      select: { id: true, email: true, firstName: true, lastName: true, role: true },
    });

    if (!realtor || realtor.role !== "REALTOR") {
      return NextResponse.json({ error: "Realtor not found" }, { status: 404 });
    }

    // For SALESMEN, verify the realtor is one of their clients
    if (userRole === "SALESMEN") {
      const isTheirClient = await prisma.user.findUnique({
        where: { id: realtorId },
        select: { freeInstallGivenBy: true },
      });

      if (!isTheirClient || isTheirClient.freeInstallGivenBy !== session.user.id) {
        return NextResponse.json(
          { error: "You can only create orders for clients you've added" },
          { status: 403 }
        );
      }
    }

    const orderNumber = await generateOrderNumber();

    const itemsToCreate = items?.map((item) => {
      const itemData: any = {
        quantity: item.quantity || 1,
        isHangingSelf: item.isHangingSelf || false,
        storagePlannedAfter: item.storagePlannedAfter ?? null,
      };

      if (item.signId && item.signId !== "HANGUP_MYSELF") {
        itemData.signId = item.signId;
      } else {
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
    }

    return NextResponse.json(order, { status: 201 });
  } catch (error: any) {
    console.error("=== Order Creation Error ===");
    console.error(error);
    return NextResponse.json(
      { error: "Internal server error", message: error.message },
      { status: 500 }
    );
  }
}
