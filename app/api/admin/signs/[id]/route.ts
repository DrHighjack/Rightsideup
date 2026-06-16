import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getLowInventoryAlertEmail, sendEmail } from "@/lib/email";

const LOW_INVENTORY_THRESHOLD = parseInt(process.env.LOW_INVENTORY_THRESHOLD || "5", 10);

// PUT /api/admin/signs/[id] - Update a sign
export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await auth();

  if (!session?.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = session.user as any;
  if (user.role !== "ADMIN") {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const signId = params.id;
    const body = await request.json();

    // Get current sign to compare status
    const currentSign = await prisma.sign.findUnique({
      where: { id: signId },
    });

    if (!currentSign) {
      return Response.json({ error: "Sign not found" }, { status: 404 });
    }

    const {
      signNumber,
      type,
      status,
      deployedAddress,
      deployedLat,
      deployedLng,
      assignedToUserId,
      notes,
    } = body;

    const updatedSign = await prisma.sign.update({
      where: { id: signId },
      data: {
        ...(signNumber !== undefined && { signNumber }),
        ...(type !== undefined && { type }),
        ...(status !== undefined && { status }),
        ...(deployedAddress !== undefined && { deployedAddress }),
        ...(deployedLat !== undefined && { deployedLat }),
        ...(deployedLng !== undefined && { deployedLng }),
        ...(assignedToUserId !== undefined && { assignedToUserId }),
        ...(notes !== undefined && { notes }),
      },
      include: {
        assignedToUser: { select: { id: true, firstName: true, lastName: true, email: true } },
        assignedToOrder: { select: { id: true, orderNumber: true } },
        reports: { where: { resolvedAt: null }, select: { id: true, type: true } },
      },
    });

    // Log activity if status changed
    // Note: No specific activity action for SIGN_STATUS_CHANGED yet

    // Check low inventory after status update
    await checkAndAlertLowInventory(updatedSign.type);

    return Response.json(updatedSign);
  } catch (err: any) {
    console.error("Error updating sign:", err);
    if (err.code === "P2002") {
      return Response.json({ error: "Sign number already exists" }, { status: 400 });
    }
    return Response.json({ error: "Failed to update sign" }, { status: 500 });
  }
}

// GET /api/admin/signs/[id] - Get a specific sign
export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const session = await auth();

  if (!session?.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = session.user as any;
  if (user.role !== "ADMIN") {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const sign = await prisma.sign.findUnique({
      where: { id: params.id },
      include: {
        assignedToUser: { select: { id: true, firstName: true, lastName: true, email: true } },
        assignedToOrder: { select: { id: true, orderNumber: true } },
        reports: {
          include: {
            reportedByUser: { select: { id: true, firstName: true, lastName: true, email: true } },
          },
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!sign) {
      return Response.json({ error: "Sign not found" }, { status: 404 });
    }

    return Response.json(sign);
  } catch (err) {
    console.error("Error fetching sign:", err);
    return Response.json({ error: "Failed to fetch sign" }, { status: 500 });
  }
}

// Helper function to check inventory and send low inventory alerts
async function checkAndAlertLowInventory(signType: string): Promise<void> {
  try {
    // Count AVAILABLE signs of this type
    const availableCount = await prisma.sign.count({
      where: {
        type: signType,
        status: "AVAILABLE",
      },
    });

    // Check if below threshold
    if (availableCount < LOW_INVENTORY_THRESHOLD) {
      // Check if we've already sent an alert for this sign type in the last 24 hours
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      
      const recentAlert = await prisma.lowInventoryAlert.findFirst({
        where: {
          signType: signType,
          sentAt: {
            gte: twentyFourHoursAgo,
          },
        },
      });

      // Only send alert if no recent alert exists
      if (!recentAlert) {
        // Send email alert
        const adminEmail = process.env.ADMIN_ALERT_EMAIL || "admin@signpost.local";
        
        try {
          const lowInventoryEmail = getLowInventoryAlertEmail(
            signType,
            availableCount,
            LOW_INVENTORY_THRESHOLD
          );

          await sendEmail({
            to: adminEmail,
            subject: lowInventoryEmail.subject,
            html: lowInventoryEmail.html,
            text: `Low Inventory Alert\n\nThe inventory for ${signType} signs has dropped below the threshold.\n\nAvailable: ${availableCount}\nThreshold: ${LOW_INVENTORY_THRESHOLD}\n\nPlease order more signs.`,
          });
        } catch (emailErr) {
          console.error("Failed to send low inventory alert email:", emailErr);
          // Continue even if email fails
        }

        // Record the alert in the database
        await prisma.lowInventoryAlert.create({
          data: {
            signType: signType,
            threshold: LOW_INVENTORY_THRESHOLD,
          },
        });

        console.log(`Low inventory alert sent for ${signType} (available: ${availableCount})`);
      }
    }
  } catch (err) {
    console.error("Error checking low inventory:", err);
    // Silently fail - don't let alert checking block sign updates
  }
}
