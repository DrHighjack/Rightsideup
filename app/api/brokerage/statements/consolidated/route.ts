import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { canAccessBrokerages } from "@/lib/brokerage-access";
import {
  generateConsolidatedBrokerageStatement,
  getCurrentMonthRange,
} from "@/lib/brokerage-statements";

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "BROKERAGE") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const brokerageIds = Array.isArray(body.brokerageIds)
    ? body.brokerageIds.filter((value: unknown): value is string => typeof value === "string")
    : [];
  if (brokerageIds.length < 2) {
    return NextResponse.json({ error: "Select at least two offices" }, { status: 400 });
  }
  if (!(await canAccessBrokerages(session.user.id, brokerageIds))) {
    return NextResponse.json({ error: "One or more offices are not available" }, { status: 403 });
  }

  try {
    const { periodStart, periodEnd } = getCurrentMonthRange();
    const result = await generateConsolidatedBrokerageStatement(
      session.user.id,
      brokerageIds,
      periodStart,
      periodEnd
    );
    if (!result.statement) {
      return NextResponse.json({ error: "No unpaid balances are available" }, { status: 409 });
    }
    return NextResponse.json(result, { status: result.created ? 201 : 200 });
  } catch (error) {
    console.error("Failed to generate consolidated brokerage statement:", error);
    return NextResponse.json({ error: "Failed to generate consolidated statement" }, { status: 500 });
  }
}