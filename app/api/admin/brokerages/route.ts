import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import bcrypt from "bcryptjs";

function isMissingEmailVerifiedColumn(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as any).code === "P2022" &&
    String((error as any)?.meta?.column || "").includes("emailVerifiedAt")
  );
}

const brokerageSchema = z.object({
  name: z.string().min(1),
  address: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  billingType: z.enum(["AGENT", "BROKERAGE"]).default("AGENT"),
  basePriceDollars: z.number().nonnegative().nullable().optional(),
  basePriceCents: z.number().int().nonnegative().nullable().optional(),
  brokerageAccount: z
    .object({
      email: z.string().email(),
      firstName: z.string().min(1),
      lastName: z.string().min(1),
      password: z.string().min(6),
    })
    .optional(),
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
        admin: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            role: true,
          },
        },
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
        brokerageOwner:
          brokerage.admin.role === "BROKERAGE"
            ? {
                id: brokerage.admin.id,
                firstName: brokerage.admin.firstName,
                lastName: brokerage.admin.lastName,
                email: brokerage.admin.email,
              }
            : null,
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

    const requesterUserId = session.user.id;

    const body = await request.json();
    const {
      name,
      address,
      phone,
      email,
      billingType,
      basePriceDollars,
      basePriceCents,
      brokerageAccount,
    } =
      brokerageSchema.parse(body);

    const normalizedBasePriceCents =
      basePriceDollars !== undefined
        ? basePriceDollars === null
          ? null
          : Math.round(basePriceDollars * 100)
        : (basePriceCents ?? null);

    if (brokerageAccount) {
      const existingOwner = await prisma.user.findUnique({
        where: { email: brokerageAccount.email.trim().toLowerCase() },
        select: { id: true },
      });

      if (existingOwner) {
        return NextResponse.json(
          { error: "Brokerage owner email is already in use" },
          { status: 400 }
        );
      }
    }

    const result = await prisma.$transaction(async (tx) => {
      let ownerId = requesterUserId;
      let ownerSummary: { id: string; email: string; firstName: string; lastName: string } | null = null;

      if (brokerageAccount) {
        const ownerPasswordHash = await bcrypt.hash(brokerageAccount.password, 12);
        let owner;
        try {
          owner = await tx.user.create({
            data: {
              email: brokerageAccount.email.trim().toLowerCase(),
              firstName: brokerageAccount.firstName.trim(),
              lastName: brokerageAccount.lastName.trim(),
              passwordHash: ownerPasswordHash,
              role: "BROKERAGE",
              brokerageName: name.trim(),
              paymentMethod: "OFFICE",
              emailVerifiedAt: new Date(),
            },
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
            },
          });
        } catch (createError) {
          if (!isMissingEmailVerifiedColumn(createError)) {
            throw createError;
          }

          owner = await tx.user.create({
            data: {
              email: brokerageAccount.email.trim().toLowerCase(),
              firstName: brokerageAccount.firstName.trim(),
              lastName: brokerageAccount.lastName.trim(),
              passwordHash: ownerPasswordHash,
              role: "BROKERAGE",
              brokerageName: name.trim(),
              paymentMethod: "OFFICE",
            },
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
            },
          });
        }

        ownerId = owner.id;
        ownerSummary = owner;
      }

      const brokerage = await tx.brokerage.create({
        data: {
          name,
          address: address || null,
          phone: phone || null,
          email: email || brokerageAccount?.email || null,
          billingType,
          basePriceCents: normalizedBasePriceCents,
          isActive: true,
          adminId: ownerId,
        },
        include: {
          _count: {
            select: {
              agents: true,
            },
          },
        },
      });

      if (ownerSummary) {
        await tx.user.update({
          where: { id: ownerSummary.id },
          data: { brokerageId: brokerage.id },
        });
      }

      return { brokerage, ownerSummary };
    });

    return NextResponse.json(
      {
        id: result.brokerage.id,
        name: result.brokerage.name,
        address: result.brokerage.address,
        phone: result.brokerage.phone,
        email: result.brokerage.email,
        billingType: result.brokerage.billingType,
        basePriceCents: result.brokerage.basePriceCents,
        isActive: result.brokerage.isActive,
        createdAt: result.brokerage.createdAt,
        updatedAt: result.brokerage.updatedAt,
        adminId: result.brokerage.adminId,
        agentCount: result.brokerage._count.agents,
        brokerageOwner: result.ownerSummary,
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
