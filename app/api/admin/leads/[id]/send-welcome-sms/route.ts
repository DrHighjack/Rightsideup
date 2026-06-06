import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendSMS, getWelcomeSMS } from "@/lib/sms";

/**
 * POST /api/admin/leads/[id]/send-welcome-sms
 * Send welcome SMS to newly converted client
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
    const { clientId, appUrl } = body;

    if (!clientId) {
      return NextResponse.json(
        { error: "clientId is required" },
        { status: 400 }
      );
    }

    // Get client details
    const client = await prisma.user.findUnique({
      where: { id: clientId },
      select: { id: true, firstName: true, phone: true },
    });

    if (!client || !client.phone) {
      return NextResponse.json(
        { error: "Client not found or no phone number available" },
        { status: 404 }
      );
    }

    // Send welcome SMS
    const smsMessage = getWelcomeSMS(
      client.firstName,
      appUrl || `${process.env.NEXTAUTH_URL}`
    );

    await sendSMS({
      to: client.phone,
      message: smsMessage,
    });

    return NextResponse.json({
      success: true,
      message: "Welcome SMS sent successfully",
      client: { id: client.id, firstName: client.firstName, phone: client.phone },
    });
  } catch (error) {
    console.error("Failed to send welcome SMS:", error);
    return NextResponse.json(
      { error: "Failed to send welcome SMS" },
      { status: 500 }
    );
  }
}
