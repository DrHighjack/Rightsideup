import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const brokerageSchema = z.object({
  name: z.string().min(1),
  address: z.string().optional(),
  phone: z.string().optional(),
  billingType: z.enum(["AGENT", "BROKERAGE"]).default("AGENT"),
  basePriceDollars: z.number().nonnegative().nullable().optional(),
  basePriceCents: z.number().int().nonnegative().nullable().optional(),
});

export async function GET(_request: NextRequest) {
  try {
    const session = await auth();
    const role = (session?.user as any)?.role;

    if (!session?.user?.id || (role !== "ADMIN" && role !== "SALESMEN")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const brokerages = await prisma.brokerage.findMany({
      include: {
        _count: {
          select: {
            agents: true,
          },
        },
      },
      orderBy: { name: "asc" },
    });

    return NextResponse.json({
      brokerages: brokerages.map((brokerage) => ({
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
      })),
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    const role = (session?.user as any)?.role;

    if (!session?.user?.id || (role !== "ADMIN" && role !== "SALESMEN")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const {
      name,
      address,
      phone,
      billingType,
      basePriceDollars,
      basePriceCents,
    } =
      brokerageSchema.parse(body);

    const normalizedBasePriceCents =
      basePriceDollars !== undefined
        ? basePriceDollars === null
          ? null
          : Math.round(basePriceDollars * 100)
        : (basePriceCents ?? null);

    const brokerage = await prisma.brokerage.create({
      data: {
        name,
        address: address || null,
        phone: phone || null,
        billingType,
        basePriceCents: normalizedBasePriceCents,
        isActive: true,
        adminId: session.user.id,
      },
      include: {
        _count: {
          select: {
            agents: true,
          },
        },
      },
    });

    return NextResponse.json(
      {
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
