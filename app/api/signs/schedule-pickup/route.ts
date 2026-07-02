import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { sendEmail } from "@/lib/email";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = session.user as any;
    if (!["REALTOR", "TC", "ADMIN"].includes(user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const signIds = Array.isArray(body?.signIds)
      ? body.signIds.filter((signId: unknown): signId is string => typeof signId === "string")
      : [];
    const preferredDate = typeof body?.preferredDate === "string" ? body.preferredDate : "";
    const notes = typeof body?.notes === "string" ? body.notes.trim() : "";
    const requestedRealtorId = typeof body?.realtorId === "string" ? body.realtorId : undefined;

    if (signIds.length === 0) {
      return NextResponse.json(
        { error: "Please select at least one sign to pick up" },
        { status: 400 }
      );
    }

    if (!preferredDate) {
      return NextResponse.json(
        { error: "Please select a preferred pickup date" },
        { status: 400 }
      );
    }

    let targetRealtorId = user.id as string;
    if (user.role === "TC") {
      if (!requestedRealtorId) {
        return NextResponse.json(
          { error: "realtorId is required for TC pickup requests" },
          { status: 400 }
        );
      }

      const link = await prisma.tCAgentLink.findUnique({
        where: {
          tcUserId_agentUserId: {
            tcUserId: user.id,
            agentUserId: requestedRealtorId,
          },
        },
      });

      if (!link) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }

      targetRealtorId = requestedRealtorId;
    } else if (user.role === "ADMIN" && requestedRealtorId) {
      targetRealtorId = requestedRealtorId;
    }

    const [realtor, signs] = await Promise.all([
      prisma.user.findUnique({
        where: { id: targetRealtorId },
        select: { id: true, firstName: true, lastName: true, email: true },
      }),
      prisma.sign.findMany({
        where: {
          id: { in: signIds },
          assignedToUserId: targetRealtorId,
          status: { in: ["DEPLOYED", "DAMAGED", "LOST"] },
        },
        select: {
          id: true,
          signNumber: true,
          type: true,
          deployedAddress: true,
          status: true,
        },
        orderBy: { signNumber: "asc" },
      }),
    ]);

    if (!realtor) {
      return NextResponse.json({ error: "Realtor not found" }, { status: 404 });
    }

    if (signs.length !== signIds.length) {
      return NextResponse.json(
        { error: "One or more selected signs are not available for pickup" },
        { status: 400 }
      );
    }

    const requesterName = user.name || user.email || "Unknown user";
    const realtorName = `${realtor.firstName} ${realtor.lastName}`.trim();
    const adminEmail = process.env.ADMIN_ALERT_EMAIL || "admin@signpost.local";

    const signListHtml = signs
      .map(
        (sign) => `
          <li>
            <strong>${sign.signNumber || sign.id}</strong> - ${sign.type}${
              sign.deployedAddress ? ` - ${sign.deployedAddress}` : ""
            } (${sign.status})
          </li>`
      )
      .join("");

    const actingAsHtml =
      user.role === "TC"
        ? `<p><strong>Acting for realtor:</strong> ${realtorName} (${realtor.email})</p>`
        : "";

    await sendEmail({
      to: adminEmail,
      subject: `Pickup Request: ${signs.length} sign${signs.length === 1 ? "" : "s"} for ${realtorName}`,
      html: `
        <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #111827;">
          <h2 style="margin-bottom: 12px;">Sign Pickup Request</h2>
          <p><strong>Requested by:</strong> ${requesterName}</p>
          ${actingAsHtml}
          <p><strong>Preferred pickup date:</strong> ${preferredDate}</p>
          ${notes ? `<p><strong>Notes:</strong> ${notes}</p>` : ""}
          <p><strong>Signs requested for pickup:</strong></p>
          <ul>${signListHtml}</ul>
        </div>
      `,
    });

    return NextResponse.json(
      {
        success: true,
        message: "Pickup scheduled successfully! We'll contact you to confirm.",
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
