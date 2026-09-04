import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { sendNewOrderDiscordWebhook } from "@/lib/discord";

/**
 * POST /api/admin/orders/[id]/schedule-removal
 * Schedule a removal order for a sign that has been installed
 * Admin only
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();

    if (!session?.user?.id || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = params;
    const body = await request.json();
    const { removalScheduledDate, removalNotes, fieldTechId } = body;

    if (!removalScheduledDate) {
      return NextResponse.json(
        { error: "Removal scheduled date is required" },
        { status: 400 }
      );
    }

    // Fetch the original installation order
    const installationOrder = await prisma.order.findUnique({
      where: { id },
      include: {
        realtor: true,
        assignedSigns: { where: { status: "DEPLOYED" }, select: { id: true }, take: 1 },
      },
    });

    if (!installationOrder) {
      return NextResponse.json(
        { error: "Installation order not found" },
        { status: 404 }
      );
    }

    if (installationOrder.type !== "INSTALL") {
      return NextResponse.json(
        { error: "Only INSTALL orders can have removals scheduled" },
        { status: 400 }
      );
    }

    // Create a new REMOVAL order with optional job assignment
    const removalOrder = await prisma.order.create({
      data: {
        orderNumber: `${installationOrder.orderNumber}-REM`,
        type: "REMOVAL",
        status: "SCHEDULED",
        address: installationOrder.address,
        addressLat: installationOrder.addressLat,
        addressLng: installationOrder.addressLng,
        scheduledDate: new Date(removalScheduledDate),
        removalSignId: installationOrder.assignedSigns[0]?.id || null,
        notes: removalNotes || `Removal scheduled for ${installationOrder.orderNumber}`,
        realtorId: installationOrder.realtorId,
        adminNotes: `Linked to installation order: ${installationOrder.orderNumber}`,
      },
    });

    // If fieldTechId is provided, assign the job to the installer
    if (fieldTechId) {
      await prisma.jobAssignment.create({
        data: {
          orderId: removalOrder.id,
          fieldTechId: fieldTechId,
          assignedByUserId: session.user.id,
          scheduledFor: new Date(removalScheduledDate),
        },
      });
    }

    await sendNewOrderDiscordWebhook({
      orderId: removalOrder.id,
      orderNumber: removalOrder.orderNumber,
      type: removalOrder.type,
      address: removalOrder.address,
      realtorName: `${installationOrder.realtor.firstName} ${installationOrder.realtor.lastName}`,
      realtorEmail: installationOrder.realtor.email,
      scheduledDate: removalOrder.scheduledDate,
      placedByRole: "ADMIN",
    }).catch((error) => console.error("Failed to send Discord order webhook:", error));

    return NextResponse.json(
      {
        message: "Removal order scheduled successfully",
        removalOrder: {
          id: removalOrder.id,
          orderNumber: removalOrder.orderNumber,
          type: removalOrder.type,
          status: removalOrder.status,
          address: removalOrder.address,
          scheduledDate: removalOrder.scheduledDate,
          createdAt: removalOrder.createdAt,
        },
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("[SCHEDULE REMOVAL] Error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to schedule removal" },
      { status: 500 }
    );
  }
}
