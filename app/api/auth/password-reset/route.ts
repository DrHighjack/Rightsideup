import { NextRequest, NextResponse } from "next/server";
import { sendEmail, getPasswordResetEmail } from "@/lib/email";
import { sendSMS, getPasswordResetSMS } from "@/lib/sms";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";
import { hash } from "bcryptjs";

// Store password reset tokens (in production, use database)
const resetTokens = new Map<
  string,
  { userId: string; expiresAt: number; phone?: string }
>();

export async function POST(request: NextRequest) {
  try {
    const { email, sendViaSMS } = await request.json();
    const forwardedProto = request.headers.get("x-forwarded-proto");
    const forwardedHost = request.headers.get("x-forwarded-host");
    const host = forwardedHost || request.headers.get("host");
    const requestOrigin = host
      ? `${forwardedProto || "https"}://${host}`
      : request.nextUrl.origin;

    const configuredAppUrl =
      process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || "";

    // Prefer the live request origin to avoid mismatched domain links.
    const appUrl = (requestOrigin || configuredAppUrl || "https://app.northshoresignco.com").replace(/\/$/, "");

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
    const resetUrl = new URL("/reset-password", appUrl);
    resetUrl.searchParams.set("token", token);
    const resetLink = resetUrl.toString();

    // Store token (expires in 24 hours)
    resetTokens.set(token, {
      userId: user.id,
      expiresAt: Date.now() + 24 * 60 * 60 * 1000,
      phone: user.phone || undefined,
    });

    // Send via email (always)
    try {
      const firstName = typeof user.firstName === "string" ? user.firstName : "User";
      const emailTemplate = getPasswordResetEmail(firstName, resetLink);
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

// PUT endpoint to set a new password using a reset token
export async function PUT(request: NextRequest) {
  try {
    const { token, password } = await request.json();

    if (!token || typeof token !== "string") {
      return NextResponse.json(
        { error: "Token is required" },
        { status: 400 }
      );
    }

    if (!password || typeof password !== "string" || password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters" },
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

    const passwordHash = await hash(password, 12);

    await prisma.user.update({
      where: { id: resetData.userId },
      data: { passwordHash },
    });

    resetTokens.delete(token);

    return NextResponse.json({ success: true, message: "Password reset successful" });
  } catch (error) {
    console.error("Password reset update error:", error);
    return NextResponse.json(
      { error: "Failed to reset password" },
      { status: 500 }
    );
  }
}
