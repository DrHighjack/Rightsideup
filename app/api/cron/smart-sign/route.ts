import { NextRequest, NextResponse } from "next/server";
import { processSmartSignSubscriptions } from "@/lib/smart-sign";

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await processSmartSignSubscriptions();
    return NextResponse.json({
      reminders: result.reminders,
      processed: result.results.length,
      charged: result.results.filter((item) => item.status === "charged").length,
      failed: result.results.filter((item) => item.status === "failed").length,
      expired: result.results.filter((item) => item.status === "expired").length,
    });
  } catch (error) {
    console.error("[SMART_SIGN] Subscription cron failed:", error);
    return NextResponse.json({ error: "Smart Sign processing failed" }, { status: 500 });
  }
}