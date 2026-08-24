import { canAccessBrokerages } from "@/lib/brokerage-access";
import { BrokerageStatementSnapshot } from "@/lib/brokerage-statements";
import { chargeVaultRecord } from "@/lib/fluidpay";
import { sendInvoicePaidDiscordWebhook } from "@/lib/discord";
import { prisma } from "@/lib/prisma";

export class BrokerageStatementPaymentError extends Error {
  constructor(message: string, public readonly statusCode: number) {
    super(message);
    this.name = "BrokerageStatementPaymentError";
  }
}

export async function payBrokerageStatement(
  actorUserId: string,
  statementId: string,
  savedPaymentMethodId: string
) {
  const user = await prisma.user.findUnique({
    where: { id: actorUserId },
    select: { vaultId: true, paymentCardLast4: true, firstName: true, lastName: true },
  });
  if (!user) throw new BrokerageStatementPaymentError("Account is unavailable", 403);

  const statement = await prisma.brokerageStatement.findFirst({
    where: { id: statementId, ownerUserId: actorUserId },
  });
  if (!statement) throw new BrokerageStatementPaymentError("Statement not found", 404);
  if (!(await canAccessBrokerages(actorUserId, statement.brokerageIds))) {
    throw new BrokerageStatementPaymentError("One or more offices are no longer available", 403);
  }
  if (!["READY", "FAILED"].includes(statement.status)) {
    throw new BrokerageStatementPaymentError("Statement is not payable", 409);
  }

  const paymentMethod = savedPaymentMethodId === `legacy:${actorUserId}` && user.vaultId
    ? { id: savedPaymentMethodId, fluidpayPaymentMethodId: user.vaultId, last4: user.paymentCardLast4 }
    : await prisma.savedPaymentMethod.findFirst({
        where: { id: savedPaymentMethodId, userId: actorUserId },
        select: { id: true, fluidpayPaymentMethodId: true, last4: true },
      });
  if (!paymentMethod) {
    throw new BrokerageStatementPaymentError("Company card not found", 404);
  }

  const snapshot = statement.snapshot as unknown as BrokerageStatementSnapshot;
  const currentInvoices = await prisma.invoice.findMany({
    where: {
      id: { in: statement.invoiceIds },
      user: { brokerageId: { in: statement.brokerageIds }, role: "REALTOR" },
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
    throw new BrokerageStatementPaymentError(
      "One or more invoice balances changed after this statement was created",
      409
    );
  }

  const claim = await prisma.brokerageStatement.updateMany({
    where: {
      id: statement.id,
      status: { in: ["READY", "FAILED"] },
      fluidpayTransactionId: null,
    },
    data: {
      status: "PAYMENT_PENDING",
      paymentMethodId: paymentMethod.id,
      autoPayFailureReason: null,
    },
  });
  if (claim.count !== 1) {
    throw new BrokerageStatementPaymentError("Statement payment is already processing", 409);
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
          autoPayScheduledAt: null,
          autoPayFailureReason: null,
        },
      });
    });

    sendInvoicePaidDiscordWebhook({
      invoiceId: statement.id,
      invoiceNumber: statement.statementNumber,
      amountCents: statement.totalCents,
      payerName: `${user.firstName || ""} ${user.lastName || ""}`.trim(),
      payerType: "BROKERAGE",
      url: `${process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || "https://app.northshoresignco.com"}/brokerage?tab=billing&statement=${statement.id}`,
    }).catch((error) => console.error("Failed to send Discord invoice paid webhook:", error));

    return { transactionId: charge.transactionId };
  } catch (error) {
    if (!chargeCompleted) {
      await prisma.brokerageStatement.updateMany({
        where: { id: statement.id, fluidpayTransactionId: null },
        data: { status: "FAILED" },
      });
    }
    throw error;
  }
}