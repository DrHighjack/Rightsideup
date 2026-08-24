import { prisma } from "@/lib/prisma";
import { getBrokerageStatementEmail, sendEmail } from "@/lib/email";
import { Prisma } from "@prisma/client";
import { OUTSTANDING_INVOICE_STATUSES } from "@/lib/invoice-totals";
import {
  getNextAutoInvoiceRun,
  isAutoInvoiceInterval,
} from "@/lib/brokerage-auto-invoicing";
import { createHash } from "crypto";

export interface BrokerageStatementSnapshot {
  brokerageName: string;
  brokerageIds: string[];
  invoices: Array<{
    id: string;
    invoiceNumber: string;
    invoiceDate: string;
    dueDate: string | null;
    realtorName: string;
    realtorEmail: string;
    brokerageId: string;
    brokerageName: string;
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
  periodEnd: Date,
  includeEarlierInvoices = true
) {
  const brokerage = await prisma.brokerage.findUnique({
    where: { id: brokerageId },
    select: { adminId: true },
  });
  if (!brokerage) {
    throw new Error("Brokerage not found or inactive");
  }

  return generateBrokerageStatementsForOwner(
    brokerage.adminId,
    [brokerageId],
    periodStart,
    periodEnd,
    includeEarlierInvoices,
    false
  );
}

export async function generateOwnedBrokerageStatement(
  ownerUserId: string,
  brokerageId: string,
  periodStart: Date,
  periodEnd: Date
) {
  return generateBrokerageStatementsForOwner(
    ownerUserId,
    [brokerageId],
    periodStart,
    periodEnd,
    true,
    false
  );
}

export async function generateConsolidatedBrokerageStatement(
  ownerUserId: string,
  brokerageIds: string[],
  periodStart: Date,
  periodEnd: Date
) {
  return generateBrokerageStatementsForOwner(
    ownerUserId,
    brokerageIds,
    periodStart,
    periodEnd,
    true,
    true
  );
}

async function generateBrokerageStatementsForOwner(
  ownerUserId: string,
  brokerageIds: string[],
  periodStart: Date,
  periodEnd: Date,
  includeEarlierInvoices: boolean,
  allowRepeat: boolean
) {
  const selectedIds = Array.from(new Set(brokerageIds)).sort();
  if (!selectedIds.length) throw new Error("Select at least one brokerage");
  const selectionKey = allowRepeat
    ? `${selectedIds.join(":")}@${periodEnd.toISOString()}`
    : selectedIds.join(":");
  const existing = await prisma.brokerageStatement.findUnique({
    where: {
      ownerUserId_periodStart_selectionKey: { ownerUserId, periodStart, selectionKey },
    },
  });
  if (existing) return { statement: existing, created: false };

  const [brokerages, owner] = await Promise.all([
    prisma.brokerage.findMany({
      where: { id: { in: selectedIds }, isActive: true },
      select: { id: true, name: true, email: true },
      orderBy: { name: "asc" },
    }),
    prisma.user.findUnique({
      where: { id: ownerUserId },
      select: { email: true, firstName: true },
    }),
  ]);
  if (brokerages.length !== selectedIds.length || !owner) {
    throw new Error("One or more brokerages are inactive or unavailable");
  }

  const previousStatements = await prisma.brokerageStatement.findMany({
    where: { status: { not: "VOIDED" }, brokerageIds: { hasSome: selectedIds } },
    select: { invoiceIds: true },
  });
  const previouslyCapturedIds = previousStatements.flatMap((statement) => statement.invoiceIds);
  const invoices = await prisma.invoice.findMany({
    where: {
      qboInvoiceId: null,
      id: previouslyCapturedIds.length ? { notIn: previouslyCapturedIds } : undefined,
      createdAt: includeEarlierInvoices
        ? { lte: periodEnd }
        : { gte: periodStart, lte: periodEnd },
      status: { in: [...OUTSTANDING_INVOICE_STATUSES] },
      user: { brokerageId: { in: selectedIds }, role: "REALTOR" },
    },
    include: {
      lineItems: { orderBy: { createdAt: "asc" } },
      user: {
        select: {
          firstName: true,
          lastName: true,
          email: true,
          brokerageId: true,
          brokerage: { select: { name: true } },
        },
      },
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
        brokerageId: invoice.user.brokerageId!,
        brokerageName: invoice.user.brokerage!.name,
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
    .filter((invoice) => invoice.balanceCents > 0)
    .sort((left, right) =>
      left.brokerageName.localeCompare(right.brokerageName) ||
      left.realtorName.localeCompare(right.realtorName) ||
      left.invoiceDate.localeCompare(right.invoiceDate)
    );

  if (!snapshotInvoices.length) return { statement: null, created: false };

  const totalCents = snapshotInvoices.reduce((sum, invoice) => sum + invoice.balanceCents, 0);
  const dueDate = new Date(periodEnd);
  dueDate.setUTCDate(dueDate.getUTCDate() + 15);
  const periodKey = `${periodStart.getUTCFullYear()}${String(periodStart.getUTCMonth() + 1).padStart(2, "0")}${String(periodStart.getUTCDate()).padStart(2, "0")}`;
  const snapshot: BrokerageStatementSnapshot = {
    brokerageName: brokerages.length === 1 ? brokerages[0].name : `${brokerages.length} offices`,
    brokerageIds: selectedIds,
    invoices: snapshotInvoices,
  };
  const statementPrefix = brokerages.length === 1 ? "BST" : "CBST";
  const statementSuffix = createHash("sha256")
    .update(`${ownerUserId}:${selectionKey}:${periodStart.toISOString()}`)
    .digest("hex")
    .slice(0, 8)
    .toUpperCase();

  let statement;
  try {
    statement = await prisma.brokerageStatement.create({
      data: {
        brokerageId: selectedIds[0],
        ownerUserId,
        brokerageIds: selectedIds,
        selectionKey,
        statementNumber: `${statementPrefix}-${periodKey}-${statementSuffix}`,
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
        where: {
          ownerUserId_periodStart_selectionKey: { ownerUserId, periodStart, selectionKey },
        },
      });
      if (concurrentStatement) return { statement: concurrentStatement, created: false };
    }
    throw error;
  }

  const recipient = brokerages.length === 1 && brokerages[0].email
    ? brokerages[0].email
    : owner.email;
  if (recipient) {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || "https://app.northshoresignco.com";
    const email = getBrokerageStatementEmail({
      recipientName: owner.firstName || snapshot.brokerageName,
      brokerageName: snapshot.brokerageName,
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
      const result = await generateBrokerageStatement(
        brokerage.id,
        periodStart,
        periodEnd,
        false
      );
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

export async function generateScheduledBrokerageStatements(now = new Date()) {
  const brokerages = await prisma.brokerage.findMany({
    where: {
      isActive: true,
      billingType: "BROKERAGE",
      autoInvoiceStatus: "APPROVED",
      autoInvoiceNextRunAt: { lte: now },
    },
    select: {
      id: true,
      autoInvoiceInterval: true,
      autoInvoicePeriodStart: true,
      autoInvoiceNextRunAt: true,
    },
  });

  const results: Array<{
    brokerageId: string;
    created: boolean;
    statementId?: string;
    error?: string;
  }> = [];

  for (const brokerage of brokerages) {
    if (
      !isAutoInvoiceInterval(brokerage.autoInvoiceInterval) ||
      !brokerage.autoInvoicePeriodStart ||
      !brokerage.autoInvoiceNextRunAt
    ) {
      results.push({
        brokerageId: brokerage.id,
        created: false,
        error: "Approved schedule is incomplete",
      });
      continue;
    }

    const periodStart = brokerage.autoInvoicePeriodStart;
    const periodEnd = brokerage.autoInvoiceNextRunAt;
    try {
      const result = await generateBrokerageStatement(brokerage.id, periodStart, periodEnd);
      const nextRunAt = getNextAutoInvoiceRun(brokerage.autoInvoiceInterval, periodEnd);
      await prisma.brokerage.updateMany({
        where: {
          id: brokerage.id,
          autoInvoiceStatus: "APPROVED",
          autoInvoiceNextRunAt: periodEnd,
        },
        data: {
          autoInvoicePeriodStart: periodEnd,
          autoInvoiceNextRunAt: nextRunAt,
        },
      });
      results.push({
        brokerageId: brokerage.id,
        created: result.created,
        statementId: result.statement?.id,
      });
    } catch (error) {
      console.error(`Scheduled statement generation failed for brokerage ${brokerage.id}:`, error);
      results.push({
        brokerageId: brokerage.id,
        created: false,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  return results;
}