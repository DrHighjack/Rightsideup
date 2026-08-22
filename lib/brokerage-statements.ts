import { prisma } from "@/lib/prisma";
import { getBrokerageStatementEmail, sendEmail } from "@/lib/email";
import { Prisma } from "@prisma/client";

export interface BrokerageStatementSnapshot {
  brokerageName: string;
  invoices: Array<{
    id: string;
    invoiceNumber: string;
    invoiceDate: string;
    dueDate: string | null;
    realtorName: string;
    realtorEmail: string;
    subtotalCents: number;
    discountCents: number;
    taxRateBps: number;
    taxCents: number;
    previouslyPaidCents: number;
    balanceCents: number;
    lineItems: Array<{
      description: string;
      quantity: number;
      unitAmount: number;
      totalAmount: number;
    }>;
  }>;
}

export function getPreviousMonthRange(now = new Date()) {
  const periodStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  const periodEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 0, 23, 59, 59, 999));
  return { periodStart, periodEnd };
}

export function getCurrentMonthRange(now = new Date()) {
  const periodStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  return { periodStart, periodEnd: now };
}

export async function generateBrokerageStatement(
  brokerageId: string,
  periodStart: Date,
  periodEnd: Date
) {
  const existing = await prisma.brokerageStatement.findUnique({
    where: { brokerageId_periodStart: { brokerageId, periodStart } },
  });
  if (existing) return { statement: existing, created: false };

  const brokerage = await prisma.brokerage.findUnique({
    where: { id: brokerageId },
    include: {
      admin: { select: { email: true, firstName: true } },
      statements: {
        where: { status: { not: "VOIDED" } },
        select: { invoiceIds: true },
      },
    },
  });
  if (!brokerage || !brokerage.isActive) {
    throw new Error("Brokerage not found or inactive");
  }

  const previouslyCapturedIds = brokerage.statements.flatMap((statement) => statement.invoiceIds);
  const invoices = await prisma.invoice.findMany({
    where: {
      id: previouslyCapturedIds.length ? { notIn: previouslyCapturedIds } : undefined,
      createdAt: { lte: periodEnd },
      status: { in: ["DRAFT", "SENT", "VIEWED", "OVERDUE"] },
      user: { brokerageId, role: "REALTOR" },
    },
    include: {
      lineItems: { orderBy: { createdAt: "asc" } },
      user: { select: { firstName: true, lastName: true, email: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  const snapshotInvoices: BrokerageStatementSnapshot["invoices"] = invoices
    .map((invoice) => {
      const subtotalCents = Math.round(invoice.amount || 0);
      const discountCents = Math.round(invoice.discountAmount || 0);
      const taxCents = invoice.taxAmount;
      const previouslyPaidCents = Math.round(invoice.paidAmount || 0);
      const balanceCents = Math.max(
        0,
        subtotalCents - discountCents + taxCents - previouslyPaidCents
      );
      return {
        id: invoice.id,
        invoiceNumber: invoice.invoiceNumber || `INV-${invoice.id.slice(0, 8).toUpperCase()}`,
        invoiceDate: invoice.createdAt.toISOString(),
        dueDate: invoice.dueDate?.toISOString() || null,
        realtorName:
          `${invoice.user.firstName || ""} ${invoice.user.lastName || ""}`.trim() ||
          invoice.user.email,
        realtorEmail: invoice.user.email,
        subtotalCents,
        discountCents,
        taxRateBps: invoice.taxRateBps,
        taxCents,
        previouslyPaidCents,
        balanceCents,
        lineItems: invoice.lineItems.length
          ? invoice.lineItems.map((item) => ({
              description: item.description,
              quantity: item.quantity,
              unitAmount: item.unitAmount,
              totalAmount: item.totalAmount,
            }))
          : [{
              description: "Service charge",
              quantity: 1,
              unitAmount: subtotalCents,
              totalAmount: subtotalCents,
            }],
      };
    })
    .filter((invoice) => invoice.balanceCents > 0);

  if (!snapshotInvoices.length) return { statement: null, created: false };

  const totalCents = snapshotInvoices.reduce((sum, invoice) => sum + invoice.balanceCents, 0);
  const dueDate = new Date(periodEnd);
  dueDate.setUTCDate(dueDate.getUTCDate() + 15);
  const periodKey = `${periodStart.getUTCFullYear()}${String(periodStart.getUTCMonth() + 1).padStart(2, "0")}`;
  const snapshot: BrokerageStatementSnapshot = {
    brokerageName: brokerage.name,
    invoices: snapshotInvoices,
  };

  let statement;
  try {
    statement = await prisma.brokerageStatement.create({
      data: {
        brokerageId,
        statementNumber: `BST-${periodKey}-${brokerageId.slice(-6).toUpperCase()}`,
        periodStart,
        periodEnd,
        dueDate,
        invoiceIds: snapshotInvoices.map((invoice) => invoice.id),
        snapshot: snapshot as unknown as Prisma.InputJsonValue,
        subtotalCents: totalCents,
        totalCents,
        status: "READY",
      },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const concurrentStatement = await prisma.brokerageStatement.findUnique({
        where: { brokerageId_periodStart: { brokerageId, periodStart } },
      });
      if (concurrentStatement) return { statement: concurrentStatement, created: false };
    }
    throw error;
  }

  const recipient = brokerage.email || brokerage.admin.email;
  if (recipient) {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || "https://app.northshoresignco.com";
    const email = getBrokerageStatementEmail({
      recipientName: brokerage.admin.firstName || brokerage.name,
      brokerageName: brokerage.name,
      statementNumber: statement.statementNumber,
      periodStart,
      periodEnd,
      invoiceCount: snapshotInvoices.length,
      totalCents,
      statementUrl: `${appUrl}/brokerage?tab=billing&statement=${statement.id}`,
      pdfUrl: `${appUrl}/api/brokerage/statements/${statement.id}/pdf`,
    });
    try {
      await sendEmail({ to: recipient, subject: email.subject, html: email.html });
      await prisma.brokerageStatement.update({
        where: { id: statement.id },
        data: { emailSentAt: new Date() },
      });
    } catch (error) {
      console.error(`Failed to send brokerage statement ${statement.id}:`, error);
    }
  }

  return { statement, created: true };
}

export async function generateMonthlyBrokerageStatements(now = new Date()) {
  const { periodStart, periodEnd } = getPreviousMonthRange(now);
  const brokerages = await prisma.brokerage.findMany({
    where: { isActive: true },
    select: { id: true },
  });

  const results: Array<{
    brokerageId: string;
    created: boolean;
    statementId?: string;
    error?: string;
  }> = [];
  for (const brokerage of brokerages) {
    try {
      const result = await generateBrokerageStatement(brokerage.id, periodStart, periodEnd);
      results.push({
        brokerageId: brokerage.id,
        created: result.created,
        statementId: result.statement?.id,
      });
    } catch (error) {
      console.error(`Statement generation failed for brokerage ${brokerage.id}:`, error);
      results.push({
        brokerageId: brokerage.id,
        created: false,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
  return results;
}