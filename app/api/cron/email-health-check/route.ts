import { NextRequest, NextResponse } from "next/server";
import { sendEmail } from "@/lib/email";

const TIME_ZONE = "America/Los_Angeles";

function getLocalHour(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: TIME_ZONE,
    hour: "2-digit",
    hourCycle: "h23",
  }).format(date);
}

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (getLocalHour(new Date()) !== "05") {
    return NextResponse.json({ skipped: true, reason: "Outside 5 AM Pacific time" });
  }

  const recipient = process.env.ADMIN_ALERT_EMAIL;
  if (!recipient) {
    return NextResponse.json({ error: "Admin alert email is not configured" }, { status: 503 });
  }

  const sentAt = new Intl.DateTimeFormat("en-US", {
    dateStyle: "full",
    timeStyle: "long",
    timeZone: TIME_ZONE,
  }).format(new Date());

  try {
    const result = await sendEmail({
      to: recipient,
      subject: "Daily email delivery test",
      text: `Daily check of the North Shore Sign Co email sender used for account verification. Sent at ${sentAt}. Receiving this email confirms delivery to this inbox; it does not test verification links or delivery to other recipients.`,
      html: `<p>Daily check of the North Shore Sign Co email sender used for account verification.</p><p>Sent at ${sentAt}.</p><p>Receiving this email confirms delivery to this inbox; it does not test verification links or delivery to other recipients.</p>`,
    });

    if (!result.success) {
      return NextResponse.json({ error: "Email provider did not accept the test message" }, { status: 503 });
    }

    return NextResponse.json({ success: true, recipient, sentAt });
  } catch (error) {
    console.error("Daily email health check failed:", error);
    return NextResponse.json({ error: "Email health check failed" }, { status: 500 });
  }
}