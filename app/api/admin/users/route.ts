import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { z } from "zod";

const createRealtorSchema = z.object({
  email: z.string().email(),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  phone: z.string().optional(),
  brokerageId: z.string().optional(),
  brokerageName: z.string().optional(),
  paymentMethod: z.enum(["OFFICE", "SELF"]).default("OFFICE"),
  closedByUserId: z.string().min(1),
  password: z
    .union([z.string().min(6), z.literal("")])
    .optional()
    .transform((v) => (v && v.trim().length > 0 ? v : undefined)),
});

export async function GET(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id || (session.user as any).role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const roleParam = searchParams.get("role");

    const validRoles = ["REALTOR", "BROKERAGE", "ADMIN", "SALESMEN", "TC", "FIELD_TECH"];
    const requestedRoles = roleParam
      ? roleParam
          .split(",")
          .map((r) => r.trim().toUpperCase())
          .filter((r) => validRoles.includes(r))
      : ["REALTOR"];

    const where: any = {
      role: requestedRoles.length === 1 ? requestedRoles[0] : { in: requestedRoles },
    };

    if (search) {
      where.OR = [
        { firstName: { contains: search, mode: "insensitive" } },
        { lastName: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
        { brokerageName: { contains: search, mode: "insensitive" } },
        { tags: { hasSome: [search] } }, // Search in tags array
      ];
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          role: true,
          brokerageId: true,
          brokerageName: true,
          phone: true,
          paymentMethod: true,
          freeInstallGivenBy: true,
          tags: true,
          createdAt: true,
          _count: {
            select: { orders: true },
          },
        },
      }),
      prisma.user.count({ where }),
    ]);

    const userIds = users.map((user) => user.id);
    let outstandingByUserId = new Map<string, number>();

    if (userIds.length > 0) {
      const invoiceTotals = await prisma.invoice.groupBy({
        by: ["userId"],
        where: {
          userId: { in: userIds },
          status: { in: ["SENT", "VIEWED", "OVERDUE"] },
        },
        _sum: {
          amount: true,
          discountAmount: true,
          paidAmount: true,
        },
      });

      outstandingByUserId = new Map(
        invoiceTotals.map((row) => {
          const amount = row._sum.amount || 0;
          const discountAmount = row._sum.discountAmount || 0;
          const paidAmount = row._sum.paidAmount || 0;
          const outstanding = Math.max(0, amount - discountAmount - paidAmount);
          return [row.userId, outstanding] as const;
        })
      );
    }

    const usersWithBalances = users.map((user) => {
      const outstandingBalance = outstandingByUserId.get(user.id) || 0;
      return {
        ...user,
        outstandingBalance,
        hasOutstandingBalance: outstandingBalance > 0,
      };
    });

    return NextResponse.json({
      users: usersWithBalances,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
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

    if (!session?.user?.id || (session.user as any).role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const {
      email,
      firstName,
      lastName,
      phone,
      brokerageId,
      brokerageName,
      paymentMethod,
      closedByUserId,
      password,
    } = createRealtorSchema.parse(body);

    let resolvedBrokerageId: string | null = null;
    let resolvedBrokerageName: string | null = brokerageName?.trim() || null;

    if (brokerageId?.trim()) {
      const brokerage = await prisma.brokerage.findUnique({
        where: { id: brokerageId.trim() },
        select: { id: true, name: true },
      });

      if (!brokerage) {
        return NextResponse.json(
          { error: "Selected brokerage not found" },
          { status: 404 }
        );
      }

      resolvedBrokerageId = brokerage.id;
      resolvedBrokerageName = brokerage.name;
    }

    const closer = await prisma.user.findUnique({
      where: { id: closedByUserId },
      select: {
        id: true,
        role: true,
        firstName: true,
        lastName: true,
      },
    });

    if (!closer || !["ADMIN", "SALESMEN"].includes(closer.role)) {
      return NextResponse.json(
        { error: "Closed By user must be an Admin or Salesman" },
        { status: 400 }
      );
    }

    const existing = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });
    if (existing) {
      return NextResponse.json(
        { error: "User with this email already exists" },
        { status: 400 }
      );
    }

    const generatedPassword = password || crypto.randomBytes(9).toString("base64url");
    const passwordHash = await bcrypt.hash(generatedPassword, 12);
    const closedByText = `Closed by ${closer.firstName} ${closer.lastName} (${closer.role})`;

    const user = await prisma.user.create({
      data: {
        email,
        firstName,
        lastName,
        phone: phone || null,
        brokerageId: resolvedBrokerageId,
        brokerageName: resolvedBrokerageName,
        paymentMethod,
        role: "REALTOR",
        passwordHash,
        // Reusing existing ownership field to track who closed the client.
        freeInstallGivenBy: closedByUserId,
        freeInstallDate: new Date(),
        adminNotes: JSON.stringify([
          {
            text: closedByText,
            createdAt: new Date().toISOString(),
            adminId: session.user.id,
          },
        ]),
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        freeInstallGivenBy: true,
      },
    });

    return NextResponse.json(
      {
        user,
        tempPassword: generatedPassword,
        message: "Realtor created successfully",
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

    console.error("Create realtor failed:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
