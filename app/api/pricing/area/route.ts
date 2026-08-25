import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { resolveAreaPriceGroup } from "@/lib/area-pricing";

export async function GET(request: NextRequest) {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!session?.user?.id || !role || !["REALTOR", "TC", "ADMIN"].includes(role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const address = new URL(request.url).searchParams.get("address") || "";
  const group = await resolveAreaPriceGroup(address);
  return NextResponse.json({ group });
}
