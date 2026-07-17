import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createFluidPaySale, isFluidPayConfigured } from "@/lib/fluidpay";
import { z } from "zod";

const PAYABLE_STATUSES = ["SENT", "VIEWED", "OVERDUE"] as const;

const paySchema = z.object({
  token: z.string().min(1, "Payment token is required"),
});

/**
 * POST /api/invoices/[id]/pay
 * Charge the invoice's outstanding balance with a FluidPay token created
 * by the hosted card fields in the browser. The amount is always computed
 * server-side from the invoice — never taken from the client.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!isFluidPayConfigured()) {
      return NextResponse.json(
        { error: "Online payments are not enabled yet. Please contact us to pay this invoice." },
        { status: 503 }
      );
    }

    const parsed = paySchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message || "Invalid request" },
        { status: 400 }
      );
    }

    const invoice = await prisma.invoice.findUnique({
      where: { id: params.id },
      include: {
        user: { select: { id: true, email: true, firstName: true, lastName: true } },
      },
    });

    if (!invoice) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }
    if (invoice.userId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (!PAYABLE_STATUSES.includes(invoice.status as any)) {
      return NextResponse.json(
        { error: `This invoice is ${invoice.status.toLowerCase()} and can't be paid online` },
        { status: 400 }
      );
    }

    // All invoice money fields are stored in cents
    const amountCents = Math.round(
      (invoice.amount || 0) - (invoice.discountAmount || 0) - (invoice.paidAmount || 0)
    );
    if (amountCents <= 0) {
      return NextResponse.json({ error: "This invoice has no outstanding balance" }, { status: 400 });
    }

    // Guard against double-submit: refuse if another charge on this invoice
    // is currently in flight or already went through.
    const existing = await prisma.payment.findFirst({
      where: {
        invoiceId: invoice.id,
        OR: [
          { status: { in: ["APPROVED", "SETTLED"] } },
          { status: "PENDING", createdAt: { gte: new Date(Date.now() - 2 * 60 * 1000) } },
        ],
      },
    });
    if (existing) {
      return NextResponse.json(
        { error: "A payment for this invoice is already processing" },
        { status: 409 }
      );
    }

    const payment = await prisma.payment.create({
      data: {
        invoiceId: invoice.id,
        userId: session.user.id,
        amountCents,
        status: "PENDING",
      },
    });

    const result = await createFluidPaySale({
      amountCents,
      token: parsed.data.token,
      orderId: invoice.invoiceNumber || invoice.id,
      description: `Invoice ${invoice.invoiceNumber || invoice.id}`,
      email: invoice.user.email,
    });

    if (!result.ok) {
      await prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: "FAILED",
          providerTransactionId: result.transactionId,
          failureReason: result.declineReason,
          rawResponse: (result.raw as any) ?? undefined,
        },
      });
      return NextResponse.json(
        { error: result.declineReason || "Payment was declined" },
        { status: 402 }
      );
    }

    const [updatedPayment, updatedInvoice] = await prisma.$transaction([
      prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: result.gatewayStatus === "settled" ? "SETTLED" : "APPROVED",
          providerTransactionId: result.transactionId,
          cardLast4: result.cardLast4,
          cardType: result.cardType,
          rawResponse: (result.raw as any) ?? undefined,
        },
      }),
      prisma.invoice.update({
        where: { id: invoice.id },
        data: {
          status: "PAID",
          paidAt: new Date(),
          paidAmount: (invoice.paidAmount || 0) + amountCents,
        },
      }),
      prisma.activityLog.create({
        data: {
          userId: session.user.id,
          action: "INVOICE_PAID",
          entityType: "Invoice",
          entityId: invoice.id,
          description: `Invoice ${invoice.invoiceNumber || invoice.id} paid online via FluidPay ($${(amountCents / 100).toFixed(2)}${result.cardLast4 ? `, card ending ${result.cardLast4}` : ""})`,
          metadata: { paymentId: payment.id, transactionId: result.transactionId },
        },
      }),
      prisma.notification.create({
        data: {
          userId: invoice.userId,
          title: "Payment received",
          message: `Your payment of $${(amountCents / 100).toFixed(2)} for invoice ${invoice.invoiceNumber || ""} was successful.`,
          type: "INVOICE_PAID",
          link: `/dashboard/invoices/${invoice.id}`,
        },
      }),
    ]);

    return NextResponse.json({
      success: true,
      invoice: updatedInvoice,
      payment: {
        id: updatedPayment.id,
        status: updatedPayment.status,
        amountCents: updatedPayment.amountCents,
        cardLast4: updatedPayment.cardLast4,
        cardType: updatedPayment.cardType,
      },
    });
  } catch (error) {
    console.error("[INVOICE PAY] Error:", error);
    return NextResponse.json(
      { error: "Payment failed due to a server error. You have not been charged twice — check the invoice status before retrying." },
      { status: 500 }
    );
  }
}
