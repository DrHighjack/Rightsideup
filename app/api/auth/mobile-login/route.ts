import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { issueMobileToken } from "@/lib/mobile-auth";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1),
  twoFactorCode: z.string().optional(),
  backupCode: z.string().optional(),
});

/**
 * POST /api/auth/mobile-login
 * Native (iOS) equivalent of the NextAuth credentials flow. Returns a
 * long-lived JWT instead of a browser cookie since the app doesn't share
 * cookie storage with Safari. The token is sent as `Authorization: Bearer`
 * on subsequent requests and verified by lib/mobile-auth.ts.
 */
export async function POST(request: NextRequest) {
  try {
    const parsed = bodySchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    const { email, password } = parsed.data;
    const normalizedEmail = email.toLowerCase();

    const user = await prisma.user.findFirst({
      where: { email: { equals: normalizedEmail, mode: "insensitive" } },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        passwordHash: true,
        tags: true,
        twoFactorEnabled: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
    }

    const validPassword = await bcrypt.compare(password, user.passwordHash);
    if (!validPassword) {
      return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
    }

    if (user.tags.includes("INACTIVE")) {
      return NextResponse.json({ error: "This account has been deactivated" }, { status: 403 });
    }

    // Admin 2FA isn't part of the iOS surface (Admin stays web-only); block it defensively.
    if (user.role === "ADMIN" && user.twoFactorEnabled) {
      return NextResponse.json(
        { error: "Admin accounts must sign in from the web app" },
        { status: 403 }
      );
    }

    if (!["REALTOR", "TC", "FIELD_TECH", "BROKERAGE"].includes(user.role)) {
      return NextResponse.json(
        { error: "This role is not supported in the mobile app" },
        { status: 403 }
      );
    }

    await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } }).catch(() => null);

    const token = await issueMobileToken({ sub: user.id, role: user.role, email: user.email });

    return NextResponse.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
      },
    });
  } catch (error) {
    console.error("[MOBILE-LOGIN] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
