import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createVaultRecord } from "@/lib/fluidpay";

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    const role = (session?.user as { role?: string } | undefined)?.role;

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (role !== "REALTOR") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, vaultId: true },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (user.vaultId) {
      return NextResponse.json({ success: true, hasCard: true });
    }

    const body = await request.json();
    const token = String(body?.token || "").trim();

    if (!token) {
      return NextResponse.json({ error: "token is required" }, { status: 400 });
    }

    const vaultId = await createVaultRecord(token, user.id);

    await prisma.user.update({
      where: { id: user.id },
      data: { vaultId },
    });

    return NextResponse.json({ success: true, hasCard: true });
  } catch (error) {
    console.error("Failed to save card:", error);
    return NextResponse.json({ error: "Failed to save card" }, { status: 500 });
  }
}
