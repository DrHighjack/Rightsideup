import { NextResponse } from "next/server";

export async function POST() {
  try {
    // Schedule pickup feature not yet fully implemented
    return NextResponse.json(
      { error: "Schedule pickup is not yet available" },
      { status: 501 }
    );
  } catch (error) {
    console.error("Schedule pickup error:", error);
    return NextResponse.json(
      { error: "Failed to schedule pickup" },
      { status: 500 }
    );
  }
}
