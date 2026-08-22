import { NextRequest, NextResponse } from "next/server";
import { generateMonthlyBrokerageStatements } from "@/lib/brokerage-statements";

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const results = await generateMonthlyBrokerageStatements();
    const failures = results.filter((result) => result.error);
    return NextResponse.json({
      processed: results.length,
      created: results.filter((result) => result.created).length,
      failed: failures.length,
      failures: failures.map((result) => ({
        brokerageId: result.brokerageId,
        error: result.error,
      })),
    }, { status: failures.length ? 500 : 200 });
  } catch (error) {
    console.error("Monthly brokerage statement generation failed:", error);
    return NextResponse.json({ error: "Statement generation failed" }, { status: 500 });
  }
}