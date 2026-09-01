import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getSignReportAlertEmail, sendEmail } from "@/lib/email";
import { sendSignReportDiscordWebhook } from "@/lib/discord";

// POST /api/signs/[id]/report - Report a sign as lost/damaged
export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await auth();

  if (!session?.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = session.user;
  if (!["REALTOR", "TC", "ADMIN"].includes(user.role)) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const signId = params.id;
    const body = await request.json();
    const { type, description } = body;

    // Validate input
    if (!type || !["LOST", "DAMAGED", "OTHER"].includes(type)) {
      return Response.json(
        { error: "type must be LOST, DAMAGED, or OTHER" },
        { status: 400 }
      );
    }

    if (!description || !description.trim()) {
      return Response.json({ error: "description is required" }, { status: 400 });
    }

    // Get sign details
    const sign = await prisma.sign.findUnique({
      where: { id: signId },
      include: {
        assignedToUser: true,
        assignedToOrder: { select: { realtorId: true } },
      },
    });

    if (!sign) {
      return Response.json({ error: "Sign not found" }, { status: 404 });
    }

    const ownerId = sign.assignedToOrder?.realtorId ?? sign.assignedToUserId;
    let authorized = user.role === "ADMIN";

    if (user.role === "REALTOR") {
      authorized = ownerId === user.id;
    } else if (user.role === "TC" && ownerId) {
      const link = await prisma.tCAgentLink.findUnique({
        where: {
          tcUserId_agentUserId: {
            tcUserId: user.id,
            agentUserId: ownerId,
          },
        },
        select: { id: true },
      });
      authorized = Boolean(link);
    }

    if (!authorized) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    // Create the report
    const report = await prisma.signReport.create({
      data: {
        signId,
        reportedByUserId: user.id,
        type,
        description,
      },
      include: {
        reportedByUser: true,
        sign: true,
      },
    });

    // Update sign status based on report type
    let newStatus = sign.status;
    if (type === "LOST") {
      newStatus = "LOST";
    } else if (type === "DAMAGED") {
      newStatus = "DAMAGED";
    }

    await prisma.sign.update({
      where: { id: signId },
      data: { status: newStatus },
    });

    // Send email to admin
    const adminEmail = process.env.ADMIN_ALERT_EMAIL || "admin@signpost.local";
    const signLink = `${process.env.NEXTAUTH_URL || "http://localhost:3001"}/admin/signs/${signId}`;

    const reporterName = user.name || user.email || "Unknown user";
    const emailTemplate = getSignReportAlertEmail(
      type,
      sign.signNumber || "N/A",
      description,
      reporterName,
      newStatus,
      signLink
    );

    try {
      await sendEmail({
        to: adminEmail,
        subject: emailTemplate.subject,
        html: emailTemplate.html,
      });
    } catch (emailErr) {
      console.error("Error sending alert email:", emailErr);
      // Don't fail the request if email fails, just log it
    }

    sendSignReportDiscordWebhook({
      signId,
      signNumber: sign.signNumber || "N/A",
      reportType: type,
      realtorName: reporterName,
      description,
    }).catch((error) => console.error("Failed to send Discord sign report webhook:", error));

    return Response.json(report, { status: 201 });
  } catch (err) {
    console.error("Error creating sign report:", err);
    return Response.json({ error: "Failed to create report" }, { status: 500 });
  }
}
