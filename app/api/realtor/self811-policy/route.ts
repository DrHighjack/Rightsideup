import { NextRequest, NextResponse } from "next/server";
import { getRequestUser } from "@/lib/mobile-auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const user = await getRequestUser(request);
    if (!user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!["REALTOR", "TC"].includes(user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const policy = await prisma.self811Policy.findFirst({ orderBy: { updatedAt: "desc" } });
    if (!policy) return NextResponse.json({ error: "Policy not found" }, { status: 404 });
    return NextResponse.json({ policy });
  } catch (error) {
    console.error("Policy GET error:", error);
    return NextResponse.json({ error: "Failed to fetch policy" }, { status: 500 });
  }
}