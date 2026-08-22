import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createVaultRecord } from "@/lib/fluidpay";
import { saveCardSchema } from "@/lib/schemas";
import { ZodError } from "zod";

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
      select: { id: true, vaultId: true, paymentCardLast4: true, paymentCardNickname: true },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const { token } = saveCardSchema.parse(await request.json());

    const vaultRecord = await createVaultRecord(token, user.id);

    const card = await prisma.savedPaymentMethod.create({
      data: {
        userId: user.id,
        fluidpayPaymentMethodId: vaultRecord.paymentMethodId,
        last4: vaultRecord.last4,
      },
      select: { id: true, last4: true, nickname: true },
    });

    if (!user.vaultId) {
      await prisma.user.update({
        where: { id: user.id },
        data: { vaultId: vaultRecord.paymentMethodId, paymentCardLast4: vaultRecord.last4 },
      });
    }

    return NextResponse.json({ success: true, hasCard: true, card });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: "Invalid input", details: error.flatten() }, { status: 400 });
    }
    console.error("Failed to save card:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to save card" },
      { status: 500 }
    );
  }
}
