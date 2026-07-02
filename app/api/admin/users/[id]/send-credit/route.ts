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
        maxUses: null,
        expiresAt: couponExpiration,
        description: `Realtor credit for ${user.firstName}`,
      },
    });

    // Send credit email
    const emailData = getFreeInstallCreditEmail(
      user.firstName,
      parsedAmount.toString(),
      couponExpiration.toLocaleDateString(),
      coupon.code,
      `Valid until ${couponExpiration.toLocaleDateString()}`,
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
