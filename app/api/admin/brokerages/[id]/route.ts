import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { calculateInvoiceBalance, calculateInvoiceTotal } from "@/lib/invoice-totals";

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
  email: z.string().trim().email().optional().or(z.literal("")),
  billingType: z.enum(["AGENT", "BROKERAGE"]).optional(),
  basePriceDollars: z.number().nonnegative().nullable().optional(),
  basePriceCents: z.number().int().nonnegative().nullable().optional(),
  isActive: z.boolean().optional(),
});

async function canAccessBrokerage(
  userId: string,
  role: string | undefined,
  brokerageId: string
) {
  if (role === "ADMIN" || role === "SALESMEN") {
    return true;
  }

  if (role !== "BROKERAGE") {
    return false;
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { brokerageId: true },
  });

  return !!user?.brokerageId && user.brokerageId === brokerageId;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();
    const role = (session?.user as any)?.role;

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const authorized = await canAccessBrokerage(session.user.id, role, params.id);
    if (!authorized) {
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

    const [invoices, orders] = await Promise.all([
      prisma.invoice.findMany({
        where: { user: { brokerageId: brokerage.id, role: "REALTOR" } },
        select: {
          id: true,
          invoiceNumber: true,
          amount: true,
          discountAmount: true,
          taxAmount: true,
          paidAmount: true,
          status: true,
          dueDate: true,
          createdAt: true,
          user: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.order.findMany({
        where: { realtor: { brokerageId: brokerage.id } },
        select: {
          id: true,
          orderNumber: true,
          type: true,
          status: true,
          address: true,
          addressLat: true,
          addressLng: true,
          createdAt: true,
          scheduledDate: true,
          realtor: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
        },
        orderBy: { createdAt: "desc" },
      }),
    ]);

    const invoiceStats = invoices.reduce(
      (stats, invoice) => {
        if (invoice.status === "VOIDED") return stats;
        const total = calculateInvoiceTotal(invoice);
        stats.lifetimeInvoiceTotal += total;
        stats.lifetimePaidTotal += Math.round(invoice.paidAmount || 0);
        if (invoice.status !== "PAID") {
          stats.outstandingBalance += calculateInvoiceBalance(invoice);
          stats.outstandingInvoiceCount += 1;
        }
        return stats;
      },
      {
        lifetimeInvoiceTotal: 0,
        lifetimePaidTotal: 0,
        outstandingBalance: 0,
        outstandingInvoiceCount: 0,
      }
    );

    return NextResponse.json({
      brokerage,
      invoices,
      pendingOrders: orders.filter((order) => order.status === "PENDING"),
      mappedOrders: orders.filter(
        (order) => order.addressLat !== null && order.addressLng !== null
      ),
      stats: {
        ...invoiceStats,
        lifetimeInvoiceCount: invoices.filter((invoice) => invoice.status !== "VOIDED").length,
        totalOrders: orders.length,
        pendingOrderCount: orders.filter((order) => order.status === "PENDING").length,
        mappedPostCount: orders.filter(
          (order) => order.addressLat !== null && order.addressLng !== null
        ).length,
      },
    });
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
    const role = (session?.user as any)?.role;

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const authorized = await canAccessBrokerage(session.user.id, role, params.id);
    if (!authorized) {
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
    const role = (session?.user as any)?.role;

    if (!session?.user?.id || (role !== "ADMIN" && role !== "SALESMEN")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const parsed = updateBrokerageSchema.parse(body);

    const normalizedBasePriceCents =
      parsed.basePriceDollars !== undefined
        ? parsed.basePriceDollars === null
          ? null
          : Math.round(parsed.basePriceDollars * 100)
        : parsed.basePriceCents;

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
        ...(parsed.email !== undefined ? { email: parsed.email || null } : {}),
        ...(parsed.billingType !== undefined
          ? { billingType: parsed.billingType }
          : {}),
        ...(normalizedBasePriceCents !== undefined
          ? { basePriceCents: normalizedBasePriceCents }
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
    const role = (session?.user as any)?.role;

    if (!session?.user?.id || (role !== "ADMIN" && role !== "SALESMEN")) {
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
