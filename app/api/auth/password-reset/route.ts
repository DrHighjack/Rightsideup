import { NextRequest, NextResponse } from "next/server";
import { sendEmail, getPasswordResetEmail } from "@/lib/email";
import { sendSMS, getPasswordResetSMS } from "@/lib/sms";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";

// Store password reset tokens (in production, use database)
const resetTokens = new Map<
  string,
  { userId: string; expiresAt: number; phone?: string }
>();

export async function POST(request: NextRequest) {
  try {
    const { email, sendViaSMS } = await request.json();

    if (!email) {
      return NextResponse.json(
        { error: "Email is required" },
        { status: 400 }
      );
    }

    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, firstName: true, email: true, phone: true },
    });

    if (!user) {
      // Don't reveal if user exists or not (security best practice)
      return NextResponse.json({
        message: "If that email exists, we've sent a reset link.",
      });
    }

    // Generate reset token
    const token = crypto.randomBytes(32).toString("hex");
    const resetLink = `${process.env.NEXT_PUBLIC_APP_URL}/reset-password?token=${token}`;

    // Store token (expires in 24 hours)
    resetTokens.set(token, {
      userId: user.id,
      expiresAt: Date.now() + 24 * 60 * 60 * 1000,
      phone: user.phone,
    });

    // Send via email (always)
    try {
      const emailTemplate = getPasswordResetEmail(user.firstName, resetLink);
      await sendEmail({
        to: user.email,
        subject: emailTemplate.subject,
        html: emailTemplate.html,
      });
    } catch (emailError) {
      console.error("Failed to send email:", emailError);
      // Continue even if email fails, try SMS if requested
    }

    // Send via SMS if requested and phone available
    if (sendViaSMS && user.phone) {
      try {
        const smsMessage = getPasswordResetSMS(user.firstName, resetLink);
        await sendSMS({
          to: user.phone,
          message: smsMessage,
        });
      } catch (smsError) {
        console.error("Failed to send SMS:", smsError);
        // Log but don't fail the request
      }
    }

    return NextResponse.json({
      message: "Password reset instructions have been sent.",
    });
  } catch (error) {
    console.error("Password reset request error:", error);
    return NextResponse.json(
      { error: "Failed to process password reset request" },
      { status: 500 }
    );
  }
}

// GET endpoint to verify token (for password reset page)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get("token");

    if (!token) {
      return NextResponse.json(
        { error: "Token is required" },
        { status: 400 }
      );
    }

    const resetData = resetTokens.get(token);

    if (!resetData) {
      return NextResponse.json(
        { error: "Invalid or expired token" },
        { status: 400 }
      );
    }

    if (resetData.expiresAt < Date.now()) {
      resetTokens.delete(token);
      return NextResponse.json(
        { error: "Token has expired" },
        { status: 400 }
      );
    }

    return NextResponse.json({
      valid: true,
      userId: resetData.userId,
    });
  } catch (error) {
    console.error("Token verification error:", error);
    return NextResponse.json(
      { error: "Failed to verify token" },
      { status: 500 }
    );
  }
}
