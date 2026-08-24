import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateOwnedBrokerageStatement, getPreviousMonthRange } from "@/lib/brokerage-statements";
import { resolveAccessibleBrokerageId } from "@/lib/brokerage-access";
import { getAccessibleBrokerages } from "@/lib/brokerage-access";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id || (session.user as { role?: string }).role !== "BROKERAGE") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [statements, accessibleBrokerages] = await Promise.all([
    prisma.brokerageStatement.findMany({
    where: { ownerUserId: session.user.id },
    orderBy: { periodStart: "desc" },
    }),
    getAccessibleBrokerages(session.user.id),
  ]);
  const accessibleIds = new Set(accessibleBrokerages.map((brokerage) => brokerage.id));
  return NextResponse.json({
    statements: statements.filter((statement) =>
      statement.brokerageIds.every((brokerageId) => accessibleIds.has(brokerageId))
    ),
  });
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id || (session.user as { role?: string }).role !== "BROKERAGE") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const brokerageId = await resolveAccessibleBrokerageId(
    session.user.id,
    new URL(request.url).searchParams.get("brokerageId")
  );
  if (!brokerageId) return NextResponse.json({ error: "Brokerage not found" }, { status: 404 });

  try {
    const { periodStart, periodEnd } = getPreviousMonthRange();
    const result = await generateOwnedBrokerageStatement(
      session.user.id,
      brokerageId,
      periodStart,
      periodEnd
    );
    if (!result.statement) {
      return NextResponse.json({ error: "No unpaid invoices are available for a statement" }, { status: 409 });
    }
    return NextResponse.json(result, { status: result.created ? 201 : 200 });
  } catch (error) {
    console.error("Failed to generate brokerage statement:", error);
    return NextResponse.json({ error: "Failed to generate statement" }, { status: 500 });
  }
}