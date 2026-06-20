import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import bcrypt from "bcryptjs";

const addAgentSchema = z.object({
  email: z.string().email(),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  phone: z.string().optional(),
  paymentMethod: z.enum(["OFFICE", "SELF"]).default("OFFICE"),
  password: z.string().min(8),
});

async function getBrokerageIdForSessionUser(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { brokerageId: true },
  });

  return user?.brokerageId || null;
}

export async function GET() {
  try {
    const session = await auth();
    const role = (session?.user as any)?.role;

    if (!session?.user?.id || role !== "BROKERAGE") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const brokerageId = await getBrokerageIdForSessionUser(session.user.id);
    if (!brokerageId) {
      return NextResponse.json({ error: "No brokerage linked to account" }, { status: 404 });
    }

    const agents = await prisma.user.findMany({
      where: {
        role: "REALTOR",
        brokerageId,
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        paymentMethod: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ agents });
  } catch (_error) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    const role = (session?.user as any)?.role;

    if (!session?.user?.id || role !== "BROKERAGE") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const brokerageId = await getBrokerageIdForSessionUser(session.user.id);
    if (!brokerageId) {
      return NextResponse.json({ error: "No brokerage linked to account" }, { status: 404 });
    }

    const body = await request.json();
    const { email, firstName, lastName, phone, paymentMethod, password } =
      addAgentSchema.parse(body);

    const normalizedEmail = email.trim().toLowerCase();

    const existingUser = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: { id: true },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "User with this email already exists" },
        { status: 400 }
      );
    }

    const brokerage = await prisma.brokerage.findUnique({
      where: { id: brokerageId },
      select: { id: true, name: true },
    });

    if (!brokerage) {
      return NextResponse.json({ error: "Brokerage not found" }, { status: 404 });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const agent = await prisma.user.create({
      data: {
        email: normalizedEmail,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        phone: phone?.trim() || null,
        role: "REALTOR",
        paymentMethod,
        brokerageId,
        brokerageName: brokerage.name,
        passwordHash,
        emailVerifiedAt: new Date(),
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        paymentMethod: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ agent }, { status: 201 });
  } catch (error: any) {
    if (error.name === "ZodError") {
      return NextResponse.json(
        { error: "Invalid input", details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
