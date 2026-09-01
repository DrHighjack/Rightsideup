import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { BROKERAGE_AUTO_PAY_DELAY_HOURS } from "@/lib/brokerage-auto-pay";
import { prisma } from "@/lib/prisma";

async function getAutoPaySettings(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      vaultId: true,
      paymentCardLast4: true,
      brokerageAutoPayEnabled: true,
      brokerageAutoPayPaymentMethodId: true,
    },
  });
  if (!user) return null;

  const selectedMethod = user.brokerageAutoPayPaymentMethodId?.startsWith("legacy:")
    ? user.vaultId
      ? { id: user.brokerageAutoPayPaymentMethodId, last4: user.paymentCardLast4 }
      : null
    : user.brokerageAutoPayPaymentMethodId
      ? await prisma.savedPaymentMethod.findFirst({
          where: { id: user.brokerageAutoPayPaymentMethodId, userId },
          select: { id: true, last4: true },
        })
      : null;

  return {
    enabled: user.brokerageAutoPayEnabled,
    paymentMethodId: selectedMethod?.id || null,
    paymentCardLast4: selectedMethod?.last4 || null,
    delayHours: BROKERAGE_AUTO_PAY_DELAY_HOURS,
  };
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "BROKERAGE") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const settings = await getAutoPaySettings(session.user.id);
  if (!settings) return NextResponse.json({ error: "Account is unavailable" }, { status: 404 });
  return NextResponse.json({ settings });
}

export async function PATCH(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "BROKERAGE") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const actorUserId = session.user.id;

  const body = (await request.json()) as {
    enabled?: unknown;
    savedPaymentMethodId?: unknown;
  };
  if (typeof body.enabled !== "boolean") {
    return NextResponse.json({ error: "Auto-pay selection is required" }, { status: 400 });
  }
  const enabled = body.enabled;
  const savedPaymentMethodId = typeof body.savedPaymentMethodId === "string"
    ? body.savedPaymentMethodId
    : "";
  if (enabled && !savedPaymentMethodId) {
    return NextResponse.json({ error: "Select a company card before enabling auto-pay" }, { status: 400 });
  }

  if (savedPaymentMethodId) {
    const paymentMethodExists = savedPaymentMethodId === `legacy:${actorUserId}`
      ? Boolean(await prisma.user.findFirst({
          where: { id: actorUserId, vaultId: { not: null } },
          select: { id: true },
        }))
      : Boolean(await prisma.savedPaymentMethod.findFirst({
          where: { id: savedPaymentMethodId, userId: actorUserId },
          select: { id: true },
        }));
    if (!paymentMethodExists) {
      return NextResponse.json({ error: "Company card not found" }, { status: 404 });
    }
  }

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: actorUserId },
      data: {
        brokerageAutoPayEnabled: enabled,
        ...(savedPaymentMethodId
          ? { brokerageAutoPayPaymentMethodId: savedPaymentMethodId }
          : {}),
      },
    });
    await tx.brokerageStatement.updateMany({
      where: {
        ownerUserId: actorUserId,
        status: "READY",
        autoPayScheduledAt: { not: null },
      },
      data: enabled
        ? { autoPayPaymentMethodId: savedPaymentMethodId }
        : { autoPayScheduledAt: null, autoPayPaymentMethodId: null },
    });
  });
  const settings = await getAutoPaySettings(actorUserId);
  return NextResponse.json({ settings });
}