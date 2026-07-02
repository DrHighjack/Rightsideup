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

    const parsedAmount = Number(creditAmount);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      return NextResponse.json(
        { error: "creditAmount must be a positive number" },
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

    const couponCode = String(creditCode).trim().toUpperCase();
    const couponExpiration = new Date(expirationDate);

    if (Number.isNaN(couponExpiration.getTime())) {
      return NextResponse.json(
        { error: "expirationDate must be a valid date" },
        { status: 400 }
      );
    }

    const existingCoupon = await prisma.coupon.findUnique({
      where: { code: couponCode },
      select: { id: true },
    });

    if (existingCoupon) {
      return NextResponse.json(
        { error: "That credit code already exists" },
        { status: 409 }
      );
    }

    const coupon = await prisma.coupon.create({
      data: {
        code: couponCode,
        type: "FIXED",
        value: parsedAmount,
        remainingValue: parsedAmount,
        isCredit: true,
        assignedUserId: params.id,
        maxUses: null,
        expiresAt: couponExpiration,
        description: `Realtor credit for ${user.firstName}`,
      },
    });

    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL ||
      process.env.NEXTAUTH_URL ||
      "https://app.northshoresignco.com";

    // Send credit email (coupon creation should not fail if email provider is unavailable)
    const emailData = getFreeInstallCreditEmail(
      user.firstName,
      `$${parsedAmount.toFixed(2)}`,
      couponExpiration.toLocaleDateString(),
      coupon.code,
      `Valid until ${couponExpiration.toLocaleDateString()}`,
      `${appUrl}/dashboard`
    );

    let emailSent = false;
    let emailErrorMessage: string | null = null;

    try {
      await sendEmail({
        to: user.email,
        subject: emailData.subject,
        html: emailData.html,
      });
      emailSent = true;
    } catch (emailError: any) {
      emailErrorMessage = emailError?.message || "Unknown email provider error";
      console.error("Credit created, but failed to send credit email:", emailError);
    }

    return NextResponse.json({
      success: true,
      emailSent,
      message: emailSent
        ? "Credit notification email sent successfully"
        : "Credit created, but email delivery failed. Please verify your SendGrid sender/template settings.",
      emailError: emailErrorMessage,
      user: { firstName: user.firstName, email: user.email },
      credit: {
        code: coupon.code,
        amount: parsedAmount,
        expiresAt: coupon.expiresAt,
      },
    });
  } catch (error) {
    console.error("Failed to send credit email:", error);
    return NextResponse.json(
      { error: "Failed to send credit email" },
      { status: 500 }
    );
  }
}
