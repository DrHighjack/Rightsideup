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

const updateBrokerageSchema = z.object({
  name: z.string().min(1).optional(),
  address: z.string().optional(),
  phone: z.string().optional(),
  billingType: z.enum(["AGENT", "BROKERAGE"]).optional(),
  basePriceCents: z.number().int().positive().nullable().optional(),
  isActive: z.boolean().optional(),
});

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();

    if (!session?.user?.id || (session.user as any).role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const brokerage = await prisma.brokerage.findUnique({
      where: { id: params.id },
      include: {
        agents: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
            paymentMethod: true,
            createdAt: true,
          },
        },
        admin: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });

    if (!brokerage) {
      return NextResponse.json(
        { error: "Brokerage not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ brokerage });
  } catch (error) {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

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
    const { email, firstName, lastName, phone, paymentMethod, password } =
      addAgentSchema.parse(body);

    // Check if brokerage exists
    const brokerage = await prisma.brokerage.findUnique({
      where: { id: params.id },
    });

    if (!brokerage) {
      return NextResponse.json(
        { error: "Brokerage not found" },
        { status: 404 }
      );
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "User with this email already exists" },
        { status: 400 }
      );
    }

    // Create password hash
    const passwordHash = await bcrypt.hash(password, 12);

    // Create new agent
    const agent = await prisma.user.create({
      data: {
        email,
        firstName,
        lastName,
        phone: phone || null,
        role: "REALTOR",
        paymentMethod,
        brokerageId: params.id,
        passwordHash,
      },
    });

    return NextResponse.json(
      {
        message: "Agent added successfully",
        agent: {
          id: agent.id,
          email: agent.email,
          firstName: agent.firstName,
          lastName: agent.lastName,
          phone: agent.phone,
          paymentMethod: agent.paymentMethod,
        },
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

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();

    if (!session?.user?.id || (session.user as any).role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const parsed = updateBrokerageSchema.parse(body);

    const existing = await prisma.brokerage.findUnique({
      where: { id: params.id },
      select: { id: true },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Brokerage not found" },
        { status: 404 }
      );
    }

    const brokerage = await prisma.brokerage.update({
      where: { id: params.id },
      data: {
        ...(parsed.name !== undefined ? { name: parsed.name } : {}),
        ...(parsed.address !== undefined ? { address: parsed.address || null } : {}),
        ...(parsed.phone !== undefined ? { phone: parsed.phone || null } : {}),
        ...(parsed.billingType !== undefined
          ? { billingType: parsed.billingType }
          : {}),
        ...(parsed.basePriceCents !== undefined
          ? { basePriceCents: parsed.basePriceCents }
          : {}),
        ...(parsed.isActive !== undefined ? { isActive: parsed.isActive } : {}),
      },
      include: {
        _count: {
          select: {
            agents: true,
          },
        },
      },
    });

    return NextResponse.json({
      id: brokerage.id,
      name: brokerage.name,
      address: brokerage.address,
      phone: brokerage.phone,
      email: brokerage.email,
      billingType: brokerage.billingType,
      basePriceCents: brokerage.basePriceCents,
      isActive: brokerage.isActive,
      createdAt: brokerage.createdAt,
      updatedAt: brokerage.updatedAt,
      adminId: brokerage.adminId,
      agentCount: brokerage._count.agents,
    });
  } catch (error: any) {
    if (error.name === "ZodError") {
      return NextResponse.json(
        { error: "Invalid input", details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();

    if (!session?.user?.id || (session.user as any).role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const existing = await prisma.brokerage.findUnique({
      where: { id: params.id },
      select: { id: true, name: true, isActive: true },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Brokerage not found" },
        { status: 404 }
      );
    }

    if (!existing.isActive) {
      return NextResponse.json({ message: "Brokerage already inactive" });
    }

    await prisma.brokerage.update({
      where: { id: params.id },
      data: { isActive: false },
    });

    return NextResponse.json({ message: "Brokerage deactivated successfully" });
  } catch (error) {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
