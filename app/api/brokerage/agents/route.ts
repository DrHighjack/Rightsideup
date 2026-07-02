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
  password: z.string().min(6),
});

const manageAgentSchema = z
  .object({
    agentId: z.string().min(1),
    paymentMethod: z.enum(["OFFICE", "SELF"]).optional(),
    inactive: z.boolean().optional(),
  })
  .refine((data) => data.paymentMethod !== undefined || data.inactive !== undefined, {
    message: "At least one update field is required",
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
        tags: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    });

    const agentIds = agents.map((agent) => agent.id);

    const [invoiceTotals, overdueCounts] = await Promise.all([
      agentIds.length
        ? prisma.invoice.groupBy({
            by: ["userId"],
            where: {
              userId: { in: agentIds },
            },
            _count: {
              _all: true,
            },
            _sum: {
              amount: true,
              discountAmount: true,
              paidAmount: true,
            },
          })
        : Promise.resolve([]),
      agentIds.length
        ? prisma.invoice.groupBy({
            by: ["userId"],
            where: {
              userId: { in: agentIds },
              status: "OVERDUE",
            },
            _count: {
              _all: true,
            },
          })
        : Promise.resolve([]),
    ]);

    const totalsByUser = new Map(
      invoiceTotals.map((row) => [
        row.userId,
        {
          invoiceCount: row._count._all,
          totalAmount: row._sum.amount || 0,
          totalDiscount: row._sum.discountAmount || 0,
          totalPaid: row._sum.paidAmount || 0,
        },
      ])
    );

    const overdueByUser = new Map(
      overdueCounts.map((row) => [row.userId, row._count._all])
    );

    const agentsWithBalances = agents.map((agent) => {
      const totals = totalsByUser.get(agent.id) || {
        invoiceCount: 0,
        totalAmount: 0,
        totalDiscount: 0,
        totalPaid: 0,
      };
      const outstanding = Math.max(
        0,
        totals.totalAmount - totals.totalDiscount - totals.totalPaid
      );
      const isInactive = Array.isArray(agent.tags) && agent.tags.includes("INACTIVE");

      return {
        ...agent,
        isInactive,
        invoiceCount: totals.invoiceCount,
        totalAmount: totals.totalAmount,
        totalPaid: totals.totalPaid,
        outstanding,
        overdueCount: overdueByUser.get(agent.id) || 0,
      };
    });

    const summary = agentsWithBalances.reduce(
      (acc, agent) => {
        acc.memberCount += 1;
        if (!agent.isInactive) {
          acc.activeCount += 1;
        }
        acc.invoiceCount += agent.invoiceCount;
        acc.totalInvoiced += agent.totalAmount;
        acc.totalPaid += agent.totalPaid;
        acc.totalOutstanding += agent.outstanding;
        acc.totalOverdue += agent.overdueCount;
        return acc;
      },
      {
        memberCount: 0,
        activeCount: 0,
        invoiceCount: 0,
        totalInvoiced: 0,
        totalPaid: 0,
        totalOutstanding: 0,
        totalOverdue: 0,
      }
    );

    return NextResponse.json({ agents: agentsWithBalances, summary });
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

export async function PATCH(request: NextRequest) {
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
    const { agentId, paymentMethod, inactive } = manageAgentSchema.parse(body);

    const agent = await prisma.user.findFirst({
      where: {
        id: agentId,
        brokerageId,
        role: "REALTOR",
      },
      select: {
        id: true,
        tags: true,
      },
    });

    if (!agent) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }

    const updatedTags = Array.isArray(agent.tags) ? [...agent.tags] : [];
    if (inactive !== undefined) {
      const hasInactiveTag = updatedTags.includes("INACTIVE");
      if (inactive && !hasInactiveTag) {
        updatedTags.push("INACTIVE");
      }
      if (!inactive && hasInactiveTag) {
        const idx = updatedTags.indexOf("INACTIVE");
        updatedTags.splice(idx, 1);
      }
    }

    const updatedAgent = await prisma.user.update({
      where: { id: agent.id },
      data: {
        ...(paymentMethod ? { paymentMethod } : {}),
        ...(inactive !== undefined ? { tags: updatedTags } : {}),
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        paymentMethod: true,
        tags: true,
      },
    });

    return NextResponse.json({
      agent: {
        ...updatedAgent,
        isInactive:
          Array.isArray(updatedAgent.tags) && updatedAgent.tags.includes("INACTIVE"),
      },
    });
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
