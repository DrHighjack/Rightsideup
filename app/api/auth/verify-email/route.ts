import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

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
