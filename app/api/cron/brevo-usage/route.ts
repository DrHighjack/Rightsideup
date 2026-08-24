import { NextRequest, NextResponse } from "next/server";
import { sendBrevoUsageReport } from "@/lib/brevo-usage";

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    return NextResponse.json(await sendBrevoUsageReport());
  } catch (error) {
    console.error("Brevo usage report failed:", error);
    return NextResponse.json({ error: "Brevo usage report failed" }, { status: 500 });
  }
}