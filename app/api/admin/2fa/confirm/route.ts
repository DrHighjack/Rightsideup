import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseTwoFactorData, serializeTwoFactorData, verifyTotpCode } from "@/lib/two-factor";
import { adminTwoFactorConfirmSchema } from "@/lib/schemas";
import { ZodError } from "zod";

export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id || (session.user as any).role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { code } = adminTwoFactorConfirmSchema.parse(await request.json());

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        twoFactorSecret: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const stored = parseTwoFactorData(user.twoFactorSecret);
    if (!stored || !stored.pending) {
      return NextResponse.json({ error: "No pending 2FA setup found" }, { status: 400 });
    }

    const valid = await verifyTotpCode(stored.secret, code);
    if (!valid) {
      return NextResponse.json({ error: "Invalid authenticator code" }, { status: 400 });
    }

    const encryptedPayload = serializeTwoFactorData({
      secret: stored.secret,
      backupCodeHashes: stored.backupCodeHashes,
      pending: false,
      createdAt: stored.createdAt || new Date().toISOString(),
    });

    await prisma.user.update({
      where: { id: user.id },
      data: {
        twoFactorSecret: encryptedPayload,
        twoFactorEnabled: true,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: "Invalid input", details: error.flatten() }, { status: 400 });
    }

    console.error("Failed to confirm 2FA setup:", error);
    return NextResponse.json({ error: "Failed to confirm 2FA setup" }, { status: 500 });
  }
}
