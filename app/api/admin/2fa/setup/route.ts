import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import QRCode from "qrcode";
import {
  buildTwoFactorQrUri,
  generateBackupCodes,
  generateTotpSecret,
  hashBackupCodes,
  serializeTwoFactorData,
} from "@/lib/two-factor";

export async function POST(_request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id || (session.user as any).role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        email: true,
        twoFactorEnabled: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (user.twoFactorEnabled) {
      return NextResponse.json({ error: "2FA is already enabled" }, { status: 400 });
    }

    const secret = generateTotpSecret();
    const otpauthUri = buildTwoFactorQrUri(user.email, secret);
    const qrCodeDataUrl = await QRCode.toDataURL(otpauthUri);

    const backupCodes = generateBackupCodes();
    const backupCodeHashes = await hashBackupCodes(backupCodes);

    const encryptedPayload = serializeTwoFactorData({
      secret,
      backupCodeHashes,
      pending: true,
      createdAt: new Date().toISOString(),
    });

    await prisma.user.update({
      where: { id: user.id },
      data: {
        twoFactorSecret: encryptedPayload,
        twoFactorEnabled: false,
      },
    });

    return NextResponse.json({
      secret,
      otpauthUri,
      qrCodeDataUrl,
      backupCodes,
      message: "Scan QR, verify a TOTP code, and save backup codes now. They will not be shown again.",
    });
  } catch (error) {
    console.error("Failed to start 2FA setup:", error);
    return NextResponse.json({ error: "Failed to start 2FA setup" }, { status: 500 });
  }
}
