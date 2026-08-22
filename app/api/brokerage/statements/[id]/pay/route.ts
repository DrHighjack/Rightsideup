import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { chargeVaultRecord } from "@/lib/fluidpay";
import { BrokerageStatementSnapshot } from "@/lib/brokerage-statements";

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user?.id || (session.user as { role?: string }).role !== "BROKERAGE") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const actorUserId = session.user.id;

  try {
    const body = (await request.json()) as { savedPaymentMethodId?: unknown };
    const savedPaymentMethodId = typeof body.savedPaymentMethodId === "string"
      ? body.savedPaymentMethodId
      : "";
    if (!savedPaymentMethodId) {
      return NextResponse.json({ error: "Select a company card" }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { id: actorUserId },
      select: {
        brokerageId: true,
        vaultId: true,
        paymentCardLast4: true,
        brokerage: { select: { isActive: true } },
      },
    });
    if (!user?.brokerageId || !user.brokerage?.isActive) {
      return NextResponse.json({ error: "Brokerage is inactive or unavailable" }, { status: 403 });
    }
    const statement = await prisma.brokerageStatement.findFirst({
      where: { id: params.id, brokerageId: user.brokerageId },
    });
    if (!statement) return NextResponse.json({ error: "Statement not found" }, { status: 404 });
    if (!['READY', 'FAILED'].includes(statement.status)) {
      return NextResponse.json({ error: "Statement is not payable" }, { status: 409 });
    }

    const paymentMethod = savedPaymentMethodId === `legacy:${actorUserId}` && user.vaultId
      ? { id: savedPaymentMethodId, fluidpayPaymentMethodId: user.vaultId, last4: user.paymentCardLast4 }
      : await prisma.savedPaymentMethod.findFirst({
          where: { id: savedPaymentMethodId, userId: actorUserId },
          select: { id: true, fluidpayPaymentMethodId: true, last4: true },
        });
    if (!paymentMethod) {
      return NextResponse.json({ error: "Company card not found" }, { status: 404 });
    }

    const snapshot = statement.snapshot as unknown as BrokerageStatementSnapshot;
    const currentInvoices = await prisma.invoice.findMany({
      where: {
        id: { in: statement.invoiceIds },
        user: { brokerageId: statement.brokerageId, role: "REALTOR" },
      },
      select: {
        id: true,
        amount: true,
        discountAmount: true,
        taxAmount: true,
        paidAmount: true,
        status: true,
      },
    });
    const currentById = new Map(currentInvoices.map((invoice) => [invoice.id, invoice]));
    const balancesMatch = snapshot.invoices.every((snapshotInvoice) => {
      const invoice = currentById.get(snapshotInvoice.id);
      if (!invoice || invoice.status === "PAID" || invoice.status === "VOIDED") return false;
      const balance = Math.max(
        0,
        Math.round(invoice.amount || 0) -
          Math.round(invoice.discountAmount || 0) -
          Math.round(invoice.paidAmount || 0) +
          invoice.taxAmount
      );
      return balance === snapshotInvoice.balanceCents;
    });
    if (!balancesMatch) {
      return NextResponse.json(
        { error: "One or more invoice balances changed after this statement was created" },
        { status: 409 }
      );
    }

    const claim = await prisma.brokerageStatement.updateMany({
      where: {
        id: statement.id,
        status: { in: ["READY", "FAILED"] },
        fluidpayTransactionId: null,
      },
      data: { status: "PAYMENT_PENDING", paymentMethodId: paymentMethod.id },
    });
    if (claim.count !== 1) {
      return NextResponse.json({ error: "Statement payment is already processing" }, { status: 409 });
    }

    let chargeCompleted = false;
    try {
      const charge = await chargeVaultRecord(
        actorUserId,
        paymentMethod.fluidpayPaymentMethodId,
        statement.totalCents,
        statement.id
      );
      chargeCompleted = true;
      await prisma.brokerageStatement.update({
        where: { id: statement.id },
        data: {
          fluidpayTransactionId: charge.transactionId,
          paymentCardLast4: paymentMethod.last4,
        },
      });
      const paidAt = new Date();

      await prisma.$transaction(async (tx) => {
        for (const snapshotInvoice of snapshot.invoices) {
          const invoice = currentById.get(snapshotInvoice.id)!;
          await tx.invoice.update({
            where: { id: invoice.id },
            data: {
              status: "PAID",
              paidAt,
              paidAmount: Math.round(invoice.paidAmount || 0) + snapshotInvoice.balanceCents,
              paidByType: "BROKERAGE",
              paidByUserId: actorUserId,
              fluidpayTransactionId: charge.transactionId,
            },
          });
          await tx.invoicePayment.create({
            data: {
              invoiceId: invoice.id,
              userId: actorUserId,
              amount: snapshotInvoice.balanceCents / 100,
              status: "PAID",
              payerType: "BROKERAGE",
              notes: `Paid on ${statement.statementNumber}`,
            },
          });
        }
        await tx.brokerageStatement.update({
          where: { id: statement.id },
          data: {
            status: "PAID",
            paidAt,
            paidAmountCents: statement.totalCents,
            paymentMethodId: paymentMethod.id,
            paymentCardLast4: paymentMethod.last4,
            fluidpayTransactionId: charge.transactionId,
          },
        });
      });

      return NextResponse.json({ success: true, transactionId: charge.transactionId });
    } catch (error) {
      if (!chargeCompleted) {
        await prisma.brokerageStatement.updateMany({
          where: { id: statement.id, fluidpayTransactionId: null },
          data: { status: "FAILED" },
        });
      }
      throw error;
    }
  } catch (error) {
    console.error("Failed to pay brokerage statement:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Statement payment failed" },
      { status: 500 }
    );
  }
}