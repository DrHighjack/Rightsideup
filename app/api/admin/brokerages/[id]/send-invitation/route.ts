import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendEmail, getBrokerageInvitationEmail } from "@/lib/email";

/**
 * POST /api/admin/brokerages/[id]/send-invitation
 * Send Brokerage invitation email
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();
    if (!session?.user?.id || (session.user as any).role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { realtorId, signupLink } = body;

    if (!realtorId || !signupLink) {
      return NextResponse.json(
        { error: "realtorId and signupLink are required" },
        { status: 400 }
      );
    }

    // Get brokerage contact details
    const brokerage = await prisma.user.findUnique({
      where: { id: params.id },
      select: { id: true, firstName: true, lastName: true, email: true, brokerageName: true },
    });

    if (!brokerage) {
      return NextResponse.json({ error: "Brokerage not found" }, { status: 404 });
    }

    // Get realtor details
    const realtor = await prisma.user.findUnique({
      where: { id: realtorId },
      select: { firstName: true, lastName: true },
    });

    if (!realtor) {
      return NextResponse.json(
        { error: "Realtor not found" },
        { status: 404 }
      );
    }

    // Send invitation email
    const emailData = getBrokerageInvitationEmail(
      `${realtor.firstName} ${realtor.lastName}`,
      brokerage.brokerageName || `${brokerage.firstName} ${brokerage.lastName}`,
      brokerage.email,
      signupLink
    );

    await sendEmail({
      to: brokerage.email,
      subject: emailData.subject,
      html: emailData.html,
    });

    return NextResponse.json({
      success: true,
      message: `Invitation sent to ${brokerage.brokerageName || brokerage.firstName}`,
      brokerage,
    });
  } catch (error) {
    console.error("Failed to send brokerage invitation:", error);
    return NextResponse.json(
      { error: "Failed to send brokerage invitation" },
      { status: 500 }
    );
  }
}
