import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
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
    const { type, address, addressLat, addressLng, scheduledDate, notes, selectedSignId, addons, self811Accepted } =
      body;

    console.log("📝 Order submission received:", {
      type,
      address,
      addressLat: { value: addressLat, type: typeof addressLat },
      addressLng: { value: addressLng, type: typeof addressLng },
      selectedSignId,
      addonsCount: addons?.length || 0,
      self811Accepted,
    });

    // Validate required fields
    if (!type || !address) {
      return NextResponse.json(
        { error: "Type and address are required" },
        { status: 400 }
      );
    }

    const orderNumber = await generateOrderNumber();

    // Prepare addons data - fetch prices before creating order
    let addonData = [];
    
    // Add selected sign as an addon with quantity 1
    if (selectedSignId) {
      try {
        console.log(`   Fetching sign: ${selectedSignId}`);
        const signItem = await prisma.inventoryItem.findUnique({
          where: { id: selectedSignId },
          select: { pricePerUnit: true }
        });
        if (signItem && signItem.pricePerUnit !== null) {
          console.log(`   ✓ Sign found: price=$${(signItem.pricePerUnit/100).toFixed(2)}`);
          addonData.push({
            inventoryItemId: selectedSignId,
            quantity: 1,
            priceAtOrder: signItem.pricePerUnit || 0,
          });
        } else {
          console.warn(`   ⚠ Sign not found: ${selectedSignId}`);
        }
      } catch (err: any) {
        console.error(`   ❌ Error fetching selected sign: ${err.message}`);
        throw new Error(`Failed to fetch sign item: ${err.message}`);
      }
    }
    
    // Add other addons
    if (addons && Array.isArray(addons) && addons.length > 0) {
      for (const addon of addons) {
        try {
          console.log(`   Fetching addon: ${addon.inventoryItemId}`);
          const item = await prisma.inventoryItem.findUnique({
            where: { id: addon.inventoryItemId },
            select: { pricePerUnit: true }
          });
          if (item && item.pricePerUnit !== null) {
            console.log(`   ✓ Addon found: qty=${addon.quantity}, price=$${(item.pricePerUnit/100).toFixed(2)}`);
            addonData.push({
              inventoryItemId: addon.inventoryItemId,
              quantity: addon.quantity,
              priceAtOrder: item?.pricePerUnit || 0,
            });
          } else {
            console.warn(`   ⚠ Addon item not found: ${addon.inventoryItemId}`);
          }
        } catch (err: any) {
          console.error(`   ❌ Error fetching addon item ${addon.inventoryItemId}: ${err.message}`);
          throw new Error(`Failed to fetch addon item: ${err.message}`);
        }
      }
    }

    console.log(`📦 Addon data prepared: ${addonData.length} items`);

    // Create order with addons
    console.log('🛠️ Creating order with Prisma...');
    let order;
    try {
      order = await prisma.order.create({
        data: {
          orderNumber,
          realtorId: session.user.id,
          type,
          address,
          addressLat: addressLat ? parseFloat(addressLat) : null,
          addressLng: addressLng ? parseFloat(addressLng) : null,
          scheduledDate: scheduledDate ? new Date(scheduledDate) : null,
          notes: notes || null,
          self811Accepted: self811Accepted || false,
          addons: {
            create: addonData,
          },
        },
        include: {
          addons: true,
        },
      });
      console.log(`✅ Order created: ${order.orderNumber}`);
    } catch (createErr: any) {
      console.error('❌ Prisma create failed:', {
        message: createErr.message,
        code: createErr.code,
        meta: createErr.meta,
      });
      throw new Error(`Order creation failed: ${createErr.message}`);
    }

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
    console.error('FULL ERROR:', JSON.stringify(error, Object.getOwnPropertyNames(error)));
    console.error("❌ Order creation error:", {
      message: error.message,
      code: error.code,
      stack: error.stack,
      fullError: error,
    });
    return NextResponse.json(
      { error: "Internal server error", details: error.message },
      { status: 500 }
    );
  }
}
