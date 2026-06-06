import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendSMS, getNotificationSMS } from "@/lib/sms";

/**
 * POST /api/admin/users/[id]/send-sms
 * Send notification SMS to user
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
    const { message } = body;

    if (!message) {
      return NextResponse.json(
        { error: "message is required" },
        { status: 400 }
      );
    }

    // Get user details
    const user = await prisma.user.findUnique({
      where: { id: params.id },
      select: { id: true, firstName: true, phone: true, email: true },
    });

    if (!user || !user.phone) {
      return NextResponse.json(
        { error: "User not found or no phone number available" },
        { status: 404 }
      );
    }

    // Send SMS
    const smsMessage = getNotificationSMS(message);

    await sendSMS({
      to: user.phone,
      message: smsMessage,
    });

    return NextResponse.json({
      success: true,
      message: "SMS sent successfully",
      user: {
        id: user.id,
        firstName: user.firstName,
        phone: user.phone,
        email: user.email,
      },
    });
  } catch (error) {
    console.error("Failed to send SMS:", error);
    return NextResponse.json(
      { error: "Failed to send SMS" },
      { status: 500 }
    );
  }
}
