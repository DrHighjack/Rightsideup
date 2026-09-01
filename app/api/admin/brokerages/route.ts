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
  allowSimilar: z.boolean().optional().default(false),
});

function normalizeBrokerageName(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function similarity(left: string, right: string) {
  const leftWords = new Set(normalizeBrokerageName(left).split(" ").filter(Boolean));
  const rightWords = new Set(normalizeBrokerageName(right).split(" ").filter(Boolean));
  const shared = [...leftWords].filter((word) => rightWords.has(word)).length;
  const total = new Set([...leftWords, ...rightWords]).size;
  return total ? shared / total : 0;
}

async function findBrokerageMatches(name: string) {
  const brokerages = await prisma.brokerage.findMany({
    select: { id: true, name: true, address: true, email: true, phone: true, isActive: true },
    orderBy: { name: "asc" },
  });
  const normalizedName = normalizeBrokerageName(name);
  const exact = brokerages.find((brokerage) => normalizeBrokerageName(brokerage.name) === normalizedName) || null;
  const similar = brokerages
    .filter((brokerage) => brokerage.id !== exact?.id && similarity(brokerage.name, name) >= 0.5)
    .map((brokerage) => ({ ...brokerage, score: similarity(brokerage.name, name) }))
    .sort((left, right) => right.score - left.score)
    .slice(0, 5);
  return { exact, similar };
}

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    const role = session?.user?.role;

    if (!session?.user?.id || (role !== "ADMIN" && role !== "SALESMEN")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const matchName = new URL(request.url).searchParams.get("match")?.trim();
    if (matchName) {
      return NextResponse.json(await findBrokerageMatches(matchName));
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
        autoInvoiceStatus: brokerage.autoInvoiceStatus,
        autoInvoiceInterval: brokerage.autoInvoiceInterval,
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
    const role = session?.user?.role;

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
      allowSimilar,
    } =
      brokerageSchema.parse(body);

    const matches = await findBrokerageMatches(name);
    if (matches.exact) {
      return NextResponse.json(
        { error: `A brokerage named ${matches.exact.name} already exists`, code: "EXACT_NAME_MATCH", brokerage: matches.exact },
        { status: 409 }
      );
    }
    if (matches.similar.length && !allowSimilar) {
      return NextResponse.json(
        { error: "Similar brokerages already exist", code: "SIMILAR_NAME_MATCH", matches: matches.similar },
        { status: 409 }
      );
    }

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
