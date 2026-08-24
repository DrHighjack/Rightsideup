import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateOrderNumber } from "@/lib/order-utils";
import { sendOrderConfirmationEmail } from "@/lib/email";
import { notifyOrderUpdate } from "@/lib/notifications";
import { sendNewOrderDiscordWebhook } from "@/lib/discord";
import { getAccessibleBrokerages } from "@/lib/brokerage-access";

function isMissingEmailVerifiedColumn(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as any).code === "P2022" &&
    String((error as any)?.meta?.column || "").includes("emailVerifiedAt")
  );
}

export async function GET(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const type = searchParams.get("type");
    const requestedRealtorId = searchParams.get("realtorId");
    const search = searchParams.get("search")?.trim();
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");

    const where: any = {};
    const role = (session.user as any).role;

    if (role === "REALTOR") {
      where.realtorId = session.user.id;
    } else if (role === "TC") {
      const linkedAgents = await prisma.tCAgentLink.findMany({
        where: { tcUserId: session.user.id },
        select: { agentUserId: true },
      });

      const linkedAgentIds = linkedAgents.map((link) => link.agentUserId);

      if (linkedAgentIds.length === 0) {
        return NextResponse.json({
          orders: [],
          pagination: {
            page,
            limit,
            total: 0,
            pages: 0,
          },
        });
      }

      if (requestedRealtorId) {
        if (!linkedAgentIds.includes(requestedRealtorId)) {
          return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }
        where.realtorId = requestedRealtorId;
      } else {
        where.realtorId = { in: linkedAgentIds };
      }
    } else if (role === "BROKERAGE") {
      const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { tags: true },
      });
      if (!user?.tags.includes("SHARED_ACCOUNTANT")) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      const brokerageIds = (await getAccessibleBrokerages(session.user.id)).map((brokerage) => brokerage.id);
      where.realtor = { brokerageId: { in: brokerageIds } };
    } else if (role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    
    if (status) where.status = status;
    if (type) where.type = type;
    if (search) {
      const nameParts = search.split(/\s+/).filter(Boolean);
      where.OR = [
        { orderNumber: { contains: search, mode: "insensitive" } },
        { address: { contains: search, mode: "insensitive" } },
        { realtor: { firstName: { contains: search, mode: "insensitive" } } },
        { realtor: { lastName: { contains: search, mode: "insensitive" } } },
        ...(nameParts.length > 1
          ? [
              {
                AND: nameParts.map((namePart) => ({
                  realtor: {
                    OR: [
                      { firstName: { contains: namePart, mode: "insensitive" } },
                      { lastName: { contains: namePart, mode: "insensitive" } },
                    ],
                  },
                })),
              },
            ]
          : []),
      ];
    }

    const orders = await prisma.order.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      include: {
        realtor: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
        ticket811: {
          select: {
            id: true,
          },
        },
        jobAssignment: {
          select: {
            completedAt: true,
            images: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const serializedOrders = orders.map((order) => {
      let mapPhotoData: string | null = null;
      let mapPhotoName: string | null = null;

      try {
        if (order.jobAssignment?.completedAt) {
          const images = order.jobAssignment.images as any;
          if (Array.isArray(images) && images.length > 0) {
            const firstImage = images[0];
            if (firstImage && typeof firstImage === "object") {
              mapPhotoData = firstImage.data || firstImage.url || null;
              mapPhotoName = firstImage.name || null;
            }
          }
        }
      } catch (imageError) {
        console.warn(`Unable to prepare map photo for order ${order.id}:`, imageError);
      }

      const { jobAssignment, ...orderWithoutJobAssignment } = order;

      return {
        ...orderWithoutJobAssignment,
        mapPhotoData,
        mapPhotoName,
      };
    });

    const total = await prisma.order.count({ where });

    return NextResponse.json({
      orders: serializedOrders,
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

    let sessionUser: { id: string; role: string; emailVerifiedAt: Date | null } | null = null;
    try {
      sessionUser = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { id: true, role: true, emailVerifiedAt: true },
      });
    } catch (error) {
      if (!isMissingEmailVerifiedColumn(error)) {
        throw error;
      }

      const legacySessionUser = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { id: true, role: true },
      });
      sessionUser = legacySessionUser
        ? { ...legacySessionUser, emailVerifiedAt: new Date() }
        : null;
    }

    if (!sessionUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!["REALTOR", "TC"].includes(sessionUser.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const {
      type,
      address,
      addressLat,
      addressLng,
      scheduledDate,
      notes,
      selectedSignId,
      addons,
      self811Accepted,
      signSetup,
      postColor,
      removalSignId,
      noLedOptOut,
      rfidListingUrl,
      realtorId,
    } = body;

    let targetRealtorId = session.user.id;

    if (sessionUser.role === "TC") {
      if (!realtorId || typeof realtorId !== "string") {
        return NextResponse.json(
          { error: "Realtor selection is required for TC orders" },
          { status: 400 }
        );
      }

      const link = await prisma.tCAgentLink.findUnique({
        where: {
          tcUserId_agentUserId: {
            tcUserId: session.user.id,
            agentUserId: realtorId,
          },
        },
      });

      if (!link) {
        return NextResponse.json(
          { error: "You are not linked to that realtor" },
          { status: 403 }
        );
      }

      targetRealtorId = realtorId;
    }

    let targetUser: { id: string; emailVerifiedAt: Date | null } | null = null;
    try {
      targetUser = await prisma.user.findUnique({
        where: { id: targetRealtorId },
        select: { id: true, emailVerifiedAt: true },
      });
    } catch (error) {
      if (!isMissingEmailVerifiedColumn(error)) {
        throw error;
      }

      const legacyTargetUser = await prisma.user.findUnique({
        where: { id: targetRealtorId },
        select: { id: true },
      });
      targetUser = legacyTargetUser
        ? { ...legacyTargetUser, emailVerifiedAt: new Date() }
        : null;
    }

    if (!targetUser?.emailVerifiedAt) {
      return NextResponse.json(
        { error: "Email verification is required before placing orders" },
        { status: 403 }
      );
    }

    console.log("📝 Order submission received:", {
      type,
      address,
      addressLat: { value: addressLat, type: typeof addressLat },
      addressLng: { value: addressLng, type: typeof addressLng },
      selectedSignId,
      addonsCount: addons?.length || 0,
      self811Accepted,
      signSetup,
      postColor,
      placedByRole: sessionUser.role,
      targetRealtorId,
    });

    const metadataLines: string[] = [];
    if (typeof signSetup === 'string') {
      metadataLines.push(`Sign setup: ${signSetup}`);
    }
    if (typeof postColor === 'string') {
      metadataLines.push(`Post color: ${postColor}`);
    }
    if (typeof self811Accepted === 'boolean') {
      metadataLines.push(`811 concierge opted out: ${self811Accepted ? 'Yes' : 'No'}`);
    }
    if (noLedOptOut === true) {
      metadataLines.push('LEDs: Customer opted out');
    }
    if (typeof rfidListingUrl === 'string' && rfidListingUrl.trim()) {
      try {
        new URL(rfidListingUrl);
      } catch {
        return NextResponse.json({ error: 'RFID listing website URL must be valid' }, { status: 400 });
      }
      metadataLines.push(`RFID listing website: ${rfidListingUrl.trim()}`);
    }

    const combinedNotes = [
      typeof notes === 'string' && notes.trim() ? notes.trim() : null,
      metadataLines.length > 0 ? `--- Order Setup ---\n${metadataLines.join('\n')}` : null,
    ]
      .filter(Boolean)
      .join('\n\n');

    // Validate required fields
    if (!type || !address) {
      return NextResponse.json(
        { error: "Type and address are required" },
        { status: 400 }
      );
    }

    if (type === 'REMOVAL') {
      if (!removalSignId || typeof removalSignId !== 'string') {
        return NextResponse.json({ error: 'A sign must be selected for removal' }, { status: 400 });
      }
      const removableSign = await prisma.sign.findFirst({
        where: { id: removalSignId, assignedToUserId: targetRealtorId, status: 'DEPLOYED' },
        select: { id: true, deployedAddress: true },
      });
      if (!removableSign) {
        return NextResponse.json({ error: 'Selected sign is not available for removal' }, { status: 409 });
      }
    }

    const orderNumber = await generateOrderNumber();

    // Prepare addons data - fetch prices before creating order
    let addonData = [];
    
    // Add selected sign as an addon with quantity 1
    if (selectedSignId && type !== 'REMOVAL') {
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
          realtorId: targetRealtorId,
          placedByTCId: sessionUser.role === "TC" ? session.user.id : null,
          type,
          address,
          addressLat: addressLat ? parseFloat(addressLat) : null,
          addressLng: addressLng ? parseFloat(addressLng) : null,
          scheduledDate: scheduledDate ? new Date(scheduledDate) : null,
          notes: combinedNotes || null,
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
      if (type === 'REMOVAL' && removalSignId) {
        await prisma.sign.update({
          where: { id: removalSignId },
          data: { assignedToOrderId: order.id },
        });
      }
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
        where: { id: targetRealtorId },
        select: { email: true, firstName: true, lastName: true, phone: true },
      });

      if (realtor) {
        await sendNewOrderDiscordWebhook({
          orderId: order.id,
          orderNumber,
          type,
          address,
          realtorName: `${realtor.firstName} ${realtor.lastName}`,
          realtorEmail: realtor.email,
          scheduledDate,
          placedByRole: sessionUser.role,
        }).catch((error) => console.error('Failed to send Discord order webhook:', error));

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
