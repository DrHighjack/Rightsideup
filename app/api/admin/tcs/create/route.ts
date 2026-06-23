import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendWelcomeEmailWithMagicLink } from "@/lib/send-welcome";

const createTCSchema = z.object({
  firstName: z.string().trim().min(1),
  lastName: z.string().trim().min(1),
  email: z.string().trim().email(),
  phone: z.string().trim().optional(),
  password: z
    .union([z.string().min(6), z.literal("")])
    .optional()
    .transform((value) => (value && value.trim().length > 0 ? value : undefined)),
});

export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id || (session.user as any).role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { firstName, lastName, email, phone, password } =
      createTCSchema.parse(body);

    const existing = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      select: { id: true },
    });

    if (existing) {
      return NextResponse.json(
        { error: "User with this email already exists" },
        { status: 400 }
      );
    }

    const generatedPassword =
      password || crypto.randomBytes(12).toString("base64url");
    const passwordHash = await bcrypt.hash(generatedPassword, 12);

    const tc = await prisma.user.create({
      data: {
        firstName,
        lastName,
        email: email.toLowerCase(),
        phone: phone || null,
        passwordHash,
        role: "TC",
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        createdAt: true,
      },
    });

    let emailWarning: string | null = null;
    try {
      await sendWelcomeEmailWithMagicLink(
        tc.id,
        tc.firstName,
        tc.email,
        generatedPassword
      );
    } catch (emailError) {
      console.error("TC created but welcome email failed:", emailError);
      emailWarning = "TC created, but welcome email could not be sent.";
    }

    return NextResponse.json(
      {
        success: true,
        message: emailWarning || "TC account created successfully",
        tc,
        generatedPassword,
        emailWarning,
      },
      { status: 201 }
    );
  } catch (error: any) {
    if (error.name === "ZodError") {
      return NextResponse.json(
        { error: "Invalid input", details: error.errors },
        { status: 400 }
      );
    }

    console.error("Failed to create TC:", error);
    return NextResponse.json(
      { error: "Failed to create TC account" },
      { status: 500 }
    );
  }
}
