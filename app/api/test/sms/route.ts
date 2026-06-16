import { NextRequest, NextResponse } from "next/server";
import { sendSMS } from "@/lib/sms";

/**
 * POST /api/test/sms
 * Test SMS endpoint - sends a test message to a phone number
 * For testing purposes only
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { phone, message } = body;

    if (!phone) {
      return NextResponse.json(
        { error: "phone is required" },
        { status: 400 }
      );
    }

    const testMessage = message || `Test message from RightSignUP - ${new Date().toLocaleString()}`;

    const result = await sendSMS({
      to: phone,
      message: testMessage,
    });

    return NextResponse.json({
      success: true,
      message: "Test SMS sent successfully",
      result,
    });
  } catch (error) {
    console.error("Test SMS error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to send test SMS" },
      { status: 500 }
    );
  }
}
