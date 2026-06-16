import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendEmail, getFreeInstallCreditEmail } from "@/lib/email";

/**
 * POST /api/admin/users/[id]/send-credit
 * Send free installation credit notification email
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
    const { creditAmount, creditCode, expirationDate } = body;

    if (!creditAmount || !creditCode || !expirationDate) {
      return NextResponse.json(
        { error: "creditAmount, creditCode, and expirationDate are required" },
        { status: 400 }
      );
    }

    // Get user details
    const user = await prisma.user.findUnique({
      where: { id: params.id },
      select: { firstName: true, email: true },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Send credit email
    const emailData = getFreeInstallCreditEmail(
      user.firstName,
      creditAmount.toString(),
      new Date(expirationDate).toLocaleDateString(),
      creditCode,
      `Valid until ${new Date(expirationDate).toLocaleDateString()}`,
      `${process.env.NEXTAUTH_URL}/dashboard`
    );

    await sendEmail({
      to: user.email,
      subject: emailData.subject,
      html: emailData.html,
    });

    return NextResponse.json({
      success: true,
      message: "Credit notification email sent successfully",
      user: { firstName: user.firstName, email: user.email },
    });
  } catch (error) {
    console.error("Failed to send credit email:", error);
    return NextResponse.json(
      { error: "Failed to send credit email" },
      { status: 500 }
    );
  }
}
