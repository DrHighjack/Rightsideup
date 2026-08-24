import { NextRequest, NextResponse } from "next/server";
import { payBrokerageStatement } from "@/lib/brokerage-statement-payments";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const statements = await prisma.brokerageStatement.findMany({
    where: {
      status: "READY",
      autoPayScheduledAt: { lte: new Date() },
      autoPayFailureReason: null,
      owner: { brokerageAutoPayEnabled: true },
    },
    select: {
      id: true,
      ownerUserId: true,
      autoPayPaymentMethodId: true,
    },
    orderBy: { autoPayScheduledAt: "asc" },
  });

  const results: Array<{ statementId: string; paid: boolean; error?: string }> = [];
  for (const statement of statements) {
    if (!statement.autoPayPaymentMethodId) continue;
    try {
      await payBrokerageStatement(
        statement.ownerUserId,
        statement.id,
        statement.autoPayPaymentMethodId
      );
      results.push({ statementId: statement.id, paid: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Automatic payment failed";
      await prisma.brokerageStatement.updateMany({
        where: { id: statement.id, fluidpayTransactionId: null },
        data: {
          autoPayScheduledAt: null,
          autoPayFailureReason: message.slice(0, 500),
        },
      });
      console.error(`Automatic payment failed for statement ${statement.id}:`, error);
      results.push({ statementId: statement.id, paid: false, error: message });
    }
  }

  return NextResponse.json({
    processed: results.length,
    paid: results.filter((result) => result.paid).length,
    failed: results.filter((result) => !result.paid).length,
    results,
  });
}