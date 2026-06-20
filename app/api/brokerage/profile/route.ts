import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const session = await auth();
    const role = (session?.user as any)?.role;

    if (!session?.user?.id || role !== "BROKERAGE") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        brokerageId: true,
      },
    });

    if (!user?.brokerageId) {
      return NextResponse.json(
        { error: "No brokerage is linked to this account" },
        { status: 404 }
      );
    }

    const brokerage = await prisma.brokerage.findUnique({
      where: { id: user.brokerageId },
      include: {
        _count: {
          select: { agents: true },
        },
      },
    });

    if (!brokerage) {
      return NextResponse.json({ error: "Brokerage not found" }, { status: 404 });
    }

    return NextResponse.json({
      brokerage: {
        id: brokerage.id,
        name: brokerage.name,
        address: brokerage.address,
        phone: brokerage.phone,
        email: brokerage.email,
        billingType: brokerage.billingType,
        basePriceCents: brokerage.basePriceCents,
        isActive: brokerage.isActive,
        agentCount: brokerage._count.agents,
      },
      owner: {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
      },
    });
  } catch (_error) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
