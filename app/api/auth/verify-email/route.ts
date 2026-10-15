import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";
import { z } from "zod";
import { getAccountVerificationEmail, sendEmail } from "@/lib/email";
import { authLimiter } from "@/lib/ratelimit";

export async function POST(request: NextRequest) {
  try {
    const parsed = z.object({ email: z.string().trim().email() }).safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Enter a valid email address" }, { status: 400 });
    }

    const email = parsed.data.email.toLowerCase();
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const ipLimit = await authLimiter.limit(`verification:ip:${ip}`);
    const emailLimit = await authLimiter.limit(`verification:email:${email}`);
    if (!ipLimit.success || !emailLimit.success) {
      return NextResponse.json({ error: "Too many requests. Please try again in 15 minutes." }, { status: 429 });
    }

    const user = await prisma.user.findFirst({
      where: { email: { equals: email, mode: "insensitive" } },
      select: {
        id: true,
        email: true,
        firstName: true,
        tags: true,
        emailVerifiedAt: true,
        emailVerificationToken: true,
        emailVerificationExpiresAt: true,
      },
    });
    const message = "If this account needs verification, a link has been sent. Check your inbox and spam folder.";
    if (!user || user.emailVerifiedAt || user.tags.includes("INACTIVE")) {
      return NextResponse.json({ message });
    }

    let token = user.emailVerificationToken;
    if (!token || !user.emailVerificationExpiresAt || user.emailVerificationExpiresAt <= new Date()) {
      token = crypto.randomUUID();
      await prisma.user.update({
        where: { id: user.id },
        data: {
          emailVerificationToken: token,
          emailVerificationExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
      });
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || "https://app.northshoresignco.com";
    const link = new URL("/verify-email", appUrl);
    link.searchParams.set("token", token);
    const template = getAccountVerificationEmail(user.firstName, link.toString());
    const result = await sendEmail({ to: user.email, subject: template.subject, html: template.html });
    if (!result.success) {
      return NextResponse.json({ error: "We could not send the verification email. Please try again later or contact billing@northshoresignco.com." }, { status: 503 });
    }

    return NextResponse.json({ message });
  } catch (error) {
    console.error("Verification email resend failed:", error);
    return NextResponse.json({ error: "We could not send the verification email. Please try again later or contact billing@northshoresignco.com." }, { status: 503 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get("token")?.trim() || "";

    if (!token) {
      return NextResponse.json({ error: "Token is required" }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { emailVerificationToken: token },
      select: {
        id: true,
        email: true,
        firstName: true,
        emailVerifiedAt: true,
        emailVerificationExpiresAt: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: "Invalid verification token" }, { status: 404 });
    }

    if (user.emailVerifiedAt) {
      return NextResponse.json({ verified: true, alreadyVerified: true });
    }

    if (!user.emailVerificationExpiresAt || user.emailVerificationExpiresAt < new Date()) {
      return NextResponse.json({ error: "Verification token has expired" }, { status: 410 });
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerifiedAt: new Date(),
        emailVerificationToken: null,
        emailVerificationExpiresAt: null,
      },
    });

    return NextResponse.json({ verified: true });
  } catch (error) {
    console.error("Email verification error:", error);
    return NextResponse.json({ error: "Failed to verify email" }, { status: 500 });
  }
}
