import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { ensureSmartSignTrial, SMART_SIGN_BUYOUT_PRICE_CENTS, SMART_SIGN_MONTHLY_PRICE_CENTS } from "@/lib/smart-sign";
import { chargeVaultRecord } from "@/lib/fluidpay";
import { prisma } from "@/lib/prisma";

async function resolvePaymentMethod(agentId: string, id: string) {
  const user = await prisma.user.findUnique({ where: { id: agentId }, select: { vaultId: true } });
  if (!user) return null;
  if (id === `legacy:${agentId}` && user.vaultId) return { fluidpayPaymentMethodId: user.vaultId };
  return prisma.savedPaymentMethod.findFirst({
    where: { id, userId: agentId },
    select: { fluidpayPaymentMethodId: true },
  });
}

export async function PATCH(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "REALTOR") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json() as { action?: unknown; savedPaymentMethodId?: unknown };
  const action = typeof body.action === "string" ? body.action : "";
  const paymentMethodId = typeof body.savedPaymentMethodId === "string" ? body.savedPaymentMethodId : "";
  const subscription = await ensureSmartSignTrial(session.user.id);

  if (action === "SAVE_CARD") {
    if (!paymentMethodId || !(await resolvePaymentMethod(session.user.id, paymentMethodId))) {
      return NextResponse.json({ error: "Select a saved payment method" }, { status: 400 });
    }
    const updated = await prisma.smartSignSubscription.update({
      where: { id: subscription.id },
      data: { savedPaymentMethodId: paymentMethodId },
    });
    return NextResponse.json({ subscription: updated });
  }

  if (action === "CANCEL") {
    const updated = await prisma.smartSignSubscription.update({
      where: { id: subscription.id },
      data: { status: "CANCELLED", cancelledAt: new Date() },
    });
    return NextResponse.json({ subscription: updated });
  }

  if (action === "BUYOUT") {
    if (!paymentMethodId) return NextResponse.json({ error: "Select a saved payment method" }, { status: 400 });
    const paymentMethod = await resolvePaymentMethod(session.user.id, paymentMethodId);
    if (!paymentMethod) return NextResponse.json({ error: "Saved payment method not found" }, { status: 404 });

    try {
      const charge = await chargeVaultRecord(session.user.id, paymentMethod.fluidpayPaymentMethodId, SMART_SIGN_BUYOUT_PRICE_CENTS, `smart-sign-buyout-${subscription.id}`);
      const updated = await prisma.smartSignSubscription.update({
        where: { id: subscription.id },
        data: {
          status: "BUYOUT",
          savedPaymentMethodId: paymentMethodId,
          buyoutPurchasedAt: new Date(),
          lastChargedAt: new Date(),
          lastTransactionId: charge.transactionId,
          billingFailureReason: null,
        },
      });
      return NextResponse.json({ subscription: updated });
    } catch (error) {
      return NextResponse.json({ error: error instanceof Error ? error.message : "Buyout charge failed" }, { status: 402 });
    }
  }

  if (action === "SUBSCRIBE") {
    if (!paymentMethodId) {
      return NextResponse.json({ error: "Select a saved payment method" }, { status: 400 });
    }
    const paymentMethod = await resolvePaymentMethod(session.user.id, paymentMethodId);
    if (!paymentMethod) return NextResponse.json({ error: "Saved payment method not found" }, { status: 404 });

    if (subscription.status === "EXPIRED" || subscription.status === "CANCELLED") {
      try {
        const charge = await chargeVaultRecord(session.user.id, paymentMethod.fluidpayPaymentMethodId, SMART_SIGN_MONTHLY_PRICE_CENTS, `smart-sign-reactivate-${subscription.id}`);
        const updated = await prisma.smartSignSubscription.update({
          where: { id: subscription.id },
          data: {
            status: "ACTIVE",
            savedPaymentMethodId: paymentMethodId,
            nextBillingAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            lastChargedAt: new Date(),
            lastTransactionId: charge.transactionId,
            billingFailureReason: null,
            cancelledAt: null,
          },
        });
        return NextResponse.json({ subscription: updated });
      } catch (error) {
        return NextResponse.json({ error: error instanceof Error ? error.message : "Subscription charge failed" }, { status: 402 });
      }
    }

    const updated = await prisma.smartSignSubscription.update({
      where: { id: subscription.id },
      data: {
        savedPaymentMethodId: paymentMethodId,
        monthlyPriceCents: SMART_SIGN_MONTHLY_PRICE_CENTS,
      },
    });
    return NextResponse.json({ subscription: updated });
  }

  return NextResponse.json({ error: "Unsupported subscription action" }, { status: 400 });
}
