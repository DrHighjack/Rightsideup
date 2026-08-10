import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { loginChallengeSchema } from "@/lib/schemas";
import { ZodError } from "zod";

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export async function POST(request: NextRequest) {
  try {
    const { email, password } = loginChallengeSchema.parse(await request.json());
    const normalizedEmail = normalizeEmail(email);

    let user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        role: true,
        passwordHash: true,
        tags: true,
        twoFactorEnabled: true,
      },
    });

    if (!user && normalizedEmail !== email) {
      user = await prisma.user.findUnique({
        where: { email: normalizedEmail },
        select: {
          id: true,
          role: true,
          passwordHash: true,
          tags: true,
          twoFactorEnabled: true,
        },
      });
    }

    if (!user) {
      user = await prisma.user.findFirst({
        where: {
          email: {
            equals: normalizedEmail,
            mode: "insensitive",
          },
        },
        select: {
          id: true,
          role: true,
          passwordHash: true,
          tags: true,
          twoFactorEnabled: true,
        },
      });
    }

    if (!user) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    if (user.tags.includes("INACTIVE")) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    const validPassword = await bcrypt.compare(password, user.passwordHash);
    if (!validPassword) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    return NextResponse.json({
      requiresTwoFactor: user.role === "ADMIN" && Boolean(user.twoFactorEnabled),
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: "Invalid input", details: error.flatten() }, { status: 400 });
    }

    console.error("2FA challenge check failed:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
