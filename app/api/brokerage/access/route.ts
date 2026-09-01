import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getAccessibleBrokerages } from "@/lib/brokerage-access";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "BROKERAGE") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const brokerages = await getAccessibleBrokerages(session.user.id);
  return NextResponse.json({ brokerages });
}