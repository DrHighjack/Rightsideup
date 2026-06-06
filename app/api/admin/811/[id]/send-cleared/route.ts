import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendEmail, get811ClearedEmail } from "@/lib/email";

/**
 * POST /api/admin/811/[id]/send-cleared
 * Send 811 clearance approval email to customer
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
    const { userId } = body;

    if (!userId) {
      return NextResponse.json(
        { error: "userId is required" },
        { status: 400 }
      );
    }

    // Get ticket details
    const ticket = await prisma.ticket811.findUnique({
      where: { id: params.id },
    });

    if (!ticket) {
      return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
    }

    // Get user details
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { firstName: true, email: true },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Send clearance email
    const firstName = typeof user.firstName === 'string' ? user.firstName : "Customer";
    const address = ticket.parsedAddress || "Property Address";
    const emailData = get811ClearedEmail(
      firstName,
      address,
      ticket.id.slice(0, 8).toUpperCase(),
      new Date(ticket.clearedAt || new Date()).toLocaleDateString(),
      `${process.env.NEXTAUTH_URL}/admin/811/${ticket.id}`
    );

    await sendEmail({
      to: user.email,
      subject: emailData.subject,
      html: emailData.html,
    });

    return NextResponse.json({
      success: true,
      message: "811 clearance email sent successfully",
      ticket,
    });
  } catch (error) {
    console.error("Failed to send 811 cleared email:", error);
    return NextResponse.json(
      { error: "Failed to send 811 cleared email" },
      { status: 500 }
    );
  }
}
