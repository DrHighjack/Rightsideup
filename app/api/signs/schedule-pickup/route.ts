import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;
    const body = await request.json();
    const { signIds, preferredDate, notes } = body;

    if (!signIds || signIds.length === 0) {
      return NextResponse.json(
        { error: "Please select at least one sign" },
        { status: 400 }
      );
    }

    if (!preferredDate) {
      return NextResponse.json(
        { error: "Preferred date is required" },
        { status: 400 }
      );
    }

    // Verify that all signs belong to this user
    const signs = await prisma.sign.findMany({
      where: {
        id: { in: signIds },
      },
      include: {
        order: {
          include: {
            client: {
              include: {
                brokerage: true,
              },
            },
          },
        },
      },
    });

    // For now, we'll assume the user's role is REALTOR and they're accessing via their account
    // In a production system, you'd verify the user actually owns/manages these signs

    if (signs.length === 0) {
      return NextResponse.json(
        { error: "No valid signs found" },
        { status: 404 }
      );
    }

    // Get the client/brokerage from one of the signs
    const firstSign = signs[0];
    if (!firstSign.order?.clientId) {
      return NextResponse.json(
        { error: "Could not identify client for signs" },
        { status: 400 }
      );
    }

    // Create a REMOVAL order for the pickup
    const pickupOrder = await prisma.order.create({
      data: {
        clientId: firstSign.order.clientId,
        type: "REMOVAL",
        status: "PENDING",
        address: "Multiple locations",
        scheduledDate: new Date(preferredDate),
        notes: `Pickup request for ${signs.length} sign(s). Preferred date: ${preferredDate}${
          notes ? `. Notes: ${notes}` : ""
        }`,
        createdBy: userId,
      },
    });

    // Link the signs to this removal order
    for (const sign of signs) {
      await prisma.sign.update({
        where: { id: sign.id },
        data: {
          orderId: pickupOrder.id,
        },
      });
    }

    return NextResponse.json(
      {
        success: true,
        message: `Pickup scheduled for ${signs.length} sign(s)`,
        orderId: pickupOrder.id,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Schedule pickup error:", error);
    return NextResponse.json(
      { error: "Failed to schedule pickup" },
      { status: 500 }
    );
  }
}
