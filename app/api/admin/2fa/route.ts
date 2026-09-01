import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseTwoFactorData } from "@/lib/two-factor";

export async function GET() {
  try {
    const session = await auth();

    if (!session?.user?.id || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        twoFactorEnabled: true,
        twoFactorSecret: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const stored = parseTwoFactorData(user.twoFactorSecret);

    return NextResponse.json({
      enabled: Boolean(user.twoFactorEnabled),
      hasPendingSetup: Boolean(stored?.pending && !user.twoFactorEnabled),
      backupCodesRemaining: stored?.backupCodeHashes?.length ?? 0,
    });
  } catch (error) {
    console.error("Failed to load 2FA status:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
