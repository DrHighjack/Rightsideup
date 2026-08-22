import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateBrokerageStatement, getPreviousMonthRange } from "@/lib/brokerage-statements";

async function getBrokerageId(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { brokerageId: true },
  });
  return user?.brokerageId || null;
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.id || (session.user as { role?: string }).role !== "BROKERAGE") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const brokerageId = await getBrokerageId(session.user.id);
  if (!brokerageId) return NextResponse.json({ error: "Brokerage not found" }, { status: 404 });

  const statements = await prisma.brokerageStatement.findMany({
    where: { brokerageId },
    orderBy: { periodStart: "desc" },
  });
  return NextResponse.json({ statements });
}

export async function POST(_request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id || (session.user as { role?: string }).role !== "BROKERAGE") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const brokerageId = await getBrokerageId(session.user.id);
  if (!brokerageId) return NextResponse.json({ error: "Brokerage not found" }, { status: 404 });

  try {
    const { periodStart, periodEnd } = getPreviousMonthRange();
    const result = await generateBrokerageStatement(brokerageId, periodStart, periodEnd);
    if (!result.statement) {
      return NextResponse.json({ error: "No unpaid invoices are available for a statement" }, { status: 409 });
    }
    return NextResponse.json(result, { status: result.created ? 201 : 200 });
  } catch (error) {
    console.error("Failed to generate brokerage statement:", error);
    return NextResponse.json({ error: "Failed to generate statement" }, { status: 500 });
  }
}