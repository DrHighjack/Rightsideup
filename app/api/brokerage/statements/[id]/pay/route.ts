import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  BrokerageStatementPaymentError,
  payBrokerageStatement,
} from "@/lib/brokerage-statement-payments";

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user?.id || (session.user as { role?: string }).role !== "BROKERAGE") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const actorUserId = session.user.id;

  try {
    const body = (await request.json()) as { savedPaymentMethodId?: unknown };
    const savedPaymentMethodId = typeof body.savedPaymentMethodId === "string"
      ? body.savedPaymentMethodId
      : "";
    if (!savedPaymentMethodId) {
      return NextResponse.json({ error: "Select a company card" }, { status: 400 });
    }

    const result = await payBrokerageStatement(actorUserId, params.id, savedPaymentMethodId);
    return NextResponse.json({ success: true, transactionId: result.transactionId });
  } catch (error) {
    console.error("Failed to pay brokerage statement:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Statement payment failed" },
      { status: error instanceof BrokerageStatementPaymentError ? error.statusCode : 500 }
    );
  }
}