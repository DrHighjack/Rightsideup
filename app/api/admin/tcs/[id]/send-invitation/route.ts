import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendEmail, getTCInvitationEmail } from "@/lib/email";

/**
 * POST /api/admin/tcs/[id]/send-invitation
 * Send Transaction Coordinator invitation email
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

    // Get TC details
    const tc = await prisma.user.findUnique({
      where: { id: params.id },
      select: { id: true, firstName: true, lastName: true, email: true },
    });

    if (!tc) {
      return NextResponse.json({ error: "TC not found" }, { status: 404 });
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
    const emailData = getTCInvitationEmail(
      `${realtor.firstName} ${realtor.lastName}`,
      tc.firstName,
      tc.email,
      signupLink
    );

    await sendEmail({
      to: tc.email,
      subject: emailData.subject,
      html: emailData.html,
    });

    return NextResponse.json({
      success: true,
      message: `Invitation sent to ${tc.firstName}`,
      tc,
    });
  } catch (error) {
    console.error("Failed to send TC invitation:", error);
    return NextResponse.json(
      { error: "Failed to send TC invitation" },
      { status: 500 }
    );
  }
}
