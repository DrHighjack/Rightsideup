import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// Verifies FluidPay's webhook signature: HMAC-SHA256 of the raw body using
// the webhook's signature key, sent hex-encoded in the `Signature` header.
// If FLUIDPAY_WEBHOOK_SECRET is unset we accept but log a warning, so the
// webhook can be wired up before the secret is copied into the env.
function verifySignature(rawBody: string, header: string | null): boolean {
  const secret = process.env.FLUIDPAY_WEBHOOK_SECRET;
  if (!secret) {
    console.warn("[FLUIDPAY WEBHOOK] FLUIDPAY_WEBHOOK_SECRET not set — accepting unverified webhook");
    return true;
  }
  if (!header) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(header.trim().toLowerCase());
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();

    if (!verifySignature(rawBody, request.headers.get("signature"))) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    let event: any;
    try {
      event = JSON.parse(rawBody);
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    // Transaction events carry the transaction under data; be liberal in
    // what we accept since event shapes vary by webhook type.
    const txn = event?.data?.transaction || event?.data || {};
    const transactionId: string | undefined = txn.id;
    const txnStatus: string | undefined = txn.status;

    if (!transactionId || !txnStatus) {
      // Not a transaction event we track — acknowledge so FluidPay stops retrying
      return NextResponse.json({ received: true });
    }

    const payment = await prisma.payment.findUnique({
      where: { providerTransactionId: transactionId },
      include: { invoice: true },
    });
    if (!payment) {
      return NextResponse.json({ received: true });
    }

    if (txnStatus === "settled" && payment.status === "APPROVED") {
      await prisma.payment.update({
        where: { id: payment.id },
        data: { status: "SETTLED" },
      });
    } else if (txnStatus === "refunded" || txnStatus === "voided") {
      const newStatus = txnStatus === "refunded" ? "REFUNDED" : "VOIDED";
      // Reopen the invoice: subtract this payment and drop PAID status
      await prisma.$transaction([
        prisma.payment.update({
          where: { id: payment.id },
          data: { status: newStatus },
        }),
        prisma.invoice.update({
          where: { id: payment.invoiceId },
          data: {
            status: "SENT",
            paidAt: null,
            paidAmount: Math.max(
              0,
              (payment.invoice.paidAmount || 0) - payment.amountCents
            ),
          },
        }),
      ]);
    } else if (txnStatus === "declined" && payment.status === "PENDING") {
      await prisma.payment.update({
        where: { id: payment.id },
        data: { status: "FAILED", failureReason: "Declined (webhook)" },
      });
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("[FLUIDPAY WEBHOOK] Error:", error);
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }
}
