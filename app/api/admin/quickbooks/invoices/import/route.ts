import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import {
  getActiveQuickBooksConnection,
  queryAllQuickBooksEntities,
} from '@/lib/quickbooks';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

interface QuickBooksCustomer {
  Id: string;
  DisplayName?: string;
  PrimaryEmailAddr?: { Address?: string };
}

interface QuickBooksInvoiceLine {
  Amount?: number;
  Description?: string;
  DetailType?: string;
  SalesItemLineDetail?: {
    ItemRef?: { name?: string };
  };
}

interface QuickBooksInvoice {
  Id: string;
  DocNumber?: string;
  TxnDate?: string;
  DueDate?: string;
  TotalAmt?: number;
  Balance?: number;
  TxnStatus?: string;
  CustomerRef?: { value?: string; name?: string };
  Line?: QuickBooksInvoiceLine[];
  TxnTaxDetail?: { TotalTax?: number };
  MetaData?: { LastUpdatedTime?: string };
}

interface UnmatchedCustomer {
  customerId: string;
  customerName: string;
  email: string | null;
  invoiceCount: number;
}

const toCents = (value: number | undefined) =>
  Math.round((Number.isFinite(Number(value)) ? Number(value) : 0) * 100);

function parseQuickBooksDate(value: string | undefined): Date | undefined {
  if (!value) return undefined;
  const date = new Date(`${value}T12:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function getInvoiceStatus(invoice: QuickBooksInvoice) {
  if (invoice.TxnStatus?.toLowerCase() === 'voided') return 'VOIDED' as const;

  const total = toCents(invoice.TotalAmt);
  const balance = Math.max(0, toCents(invoice.Balance));
  if (balance === 0) return 'PAID' as const;

  const dueDate = parseQuickBooksDate(invoice.DueDate);
  if (dueDate && dueDate.getTime() < Date.now()) return 'OVERDUE' as const;
  return total > 0 ? 'SENT' as const : 'VOIDED' as const;
}

function getDiscountAmount(invoice: QuickBooksInvoice) {
  return (invoice.Line || [])
    .filter((line) => line.DetailType === 'DiscountLineDetail')
    .reduce((sum, line) => sum + toCents(line.Amount), 0);
}

function getLineItems(invoice: QuickBooksInvoice, subtotal: number) {
  const lineItems = (invoice.Line || [])
    .filter((line) =>
      line.DetailType !== 'DiscountLineDetail' &&
      line.DetailType !== 'SubTotalLineDetail' &&
      line.DetailType !== 'TaxLineDetail' &&
      toCents(line.Amount) !== 0
    )
    .map((line) => {
      const totalAmount = toCents(line.Amount);
      return {
        description:
          line.Description?.trim() ||
          line.SalesItemLineDetail?.ItemRef?.name ||
          'QuickBooks invoice item',
        quantity: 1,
        unitAmount: totalAmount,
        totalAmount,
      };
    });

  const lineTotal = lineItems.reduce((sum, line) => sum + line.totalAmount, 0);
  const adjustment = subtotal - lineTotal;
  if (adjustment !== 0) {
    lineItems.push({
      description: lineItems.length === 0
        ? `QuickBooks invoice ${invoice.DocNumber || invoice.Id}`
        : 'QuickBooks invoice adjustment',
      quantity: 1,
      unitAmount: adjustment,
      totalAmount: adjustment,
    });
  }

  return lineItems.length > 0
    ? lineItems
    : [{
        description: `QuickBooks invoice ${invoice.DocNumber || invoice.Id}`,
        quantity: 1,
        unitAmount: subtotal,
        totalAmount: subtotal,
      }];
}

export async function POST() {
  try {
    const session = await auth();
    if (!session?.user?.id || (session.user as { role?: string }).role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const connection = await getActiveQuickBooksConnection();
    const [customers, quickBooksInvoices, users, existingInvoices] = await Promise.all([
      queryAllQuickBooksEntities<QuickBooksCustomer>(connection, 'Customer'),
      queryAllQuickBooksEntities<QuickBooksInvoice>(connection, 'Invoice'),
      prisma.user.findMany({
        where: { role: 'REALTOR' },
        select: { id: true, email: true, qboCustomerId: true },
      }),
      prisma.invoice.findMany({
        where: { qboInvoiceId: { not: null } },
        select: { qboInvoiceId: true, invoiceNumber: true },
      }),
    ]);

    const usersByEmail = new Map(
      users.map((user) => [user.email.trim().toLowerCase(), user])
    );
    const usersByCustomerId = new Map(
      users
        .filter((user) => user.qboCustomerId)
        .map((user) => [user.qboCustomerId as string, user])
    );
    const customersById = new Map(customers.map((customer) => [customer.Id, customer]));
    const existingQuickBooksIds = new Set(
      existingInvoices.flatMap((invoice) => invoice.qboInvoiceId ? [invoice.qboInvoiceId] : [])
    );
    const existingInvoiceNumbers = new Set(
      (await prisma.invoice.findMany({
        where: { invoiceNumber: { not: null } },
        select: { invoiceNumber: true },
      })).flatMap((invoice) => invoice.invoiceNumber ? [invoice.invoiceNumber] : [])
    );

    const unmatchedCustomers = new Map<string, UnmatchedCustomer>();
    const conflicts: Array<{ quickBooksId: string; invoiceNumber: string }> = [];
    const errors: Array<{ quickBooksId: string; invoiceNumber: string | null; error: string }> = [];
    let imported = 0;
    let skippedDuplicates = 0;

    for (const quickBooksInvoice of quickBooksInvoices) {
      if (existingQuickBooksIds.has(quickBooksInvoice.Id)) {
        skippedDuplicates += 1;
        continue;
      }

      const customerId = quickBooksInvoice.CustomerRef?.value || '';
      const customer = customersById.get(customerId);
      const customerEmail = customer?.PrimaryEmailAddr?.Address?.trim().toLowerCase() || null;
      const user = usersByCustomerId.get(customerId) ||
        (customerEmail ? usersByEmail.get(customerEmail) : undefined);

      if (!user) {
        const existing = unmatchedCustomers.get(customerId);
        unmatchedCustomers.set(customerId, {
          customerId,
          customerName:
            customer?.DisplayName || quickBooksInvoice.CustomerRef?.name || 'Unknown customer',
          email: customerEmail,
          invoiceCount: (existing?.invoiceCount || 0) + 1,
        });
        continue;
      }

      const invoiceNumber = quickBooksInvoice.DocNumber?.trim() ||
        `QB-${connection.realmId}-${quickBooksInvoice.Id}`;
      if (existingInvoiceNumbers.has(invoiceNumber)) {
        conflicts.push({ quickBooksId: quickBooksInvoice.Id, invoiceNumber });
        continue;
      }

      const total = Math.max(0, toCents(quickBooksInvoice.TotalAmt));
      const taxAmount = Math.max(0, toCents(quickBooksInvoice.TxnTaxDetail?.TotalTax));
      const discountAmount = Math.abs(getDiscountAmount(quickBooksInvoice));
      const subtotal = Math.max(0, total - taxAmount + discountAmount);
      const taxableAmount = Math.max(0, subtotal - discountAmount);
      const taxRateBps = taxableAmount > 0
        ? Math.round((taxAmount / taxableAmount) * 10_000)
        : 0;
      const balance = Math.max(0, Math.min(total, toCents(quickBooksInvoice.Balance)));
      const paidAmount = Math.max(0, total - balance);
      const status = getInvoiceStatus(quickBooksInvoice);

      try {
        await prisma.$transaction(async (transaction) => {
          if (!user.qboCustomerId && customerId) {
            await transaction.user.update({
              where: { id: user.id },
              data: { qboCustomerId: customerId },
            });
            user.qboCustomerId = customerId;
            usersByCustomerId.set(customerId, user);
          }

          await transaction.invoice.create({
            data: {
              userId: user.id,
              invoiceNumber,
              qboInvoiceId: quickBooksInvoice.Id,
              amount: subtotal,
              discountAmount,
              taxRateBps,
              taxAmount,
              status,
              dueDate: parseQuickBooksDate(quickBooksInvoice.DueDate),
              paidAmount,
              paidByType: paidAmount > 0 ? 'QUICKBOOKS' : null,
              paidAt: null,
              createdAt: parseQuickBooksDate(quickBooksInvoice.TxnDate),
              lineItems: {
                create: getLineItems(quickBooksInvoice, subtotal),
              },
            },
          });
        });
      } catch (error) {
        errors.push({
          quickBooksId: quickBooksInvoice.Id,
          invoiceNumber: quickBooksInvoice.DocNumber || null,
          error: error instanceof Error ? error.message : 'Database import failed',
        });
        continue;
      }

      existingQuickBooksIds.add(quickBooksInvoice.Id);
      existingInvoiceNumbers.add(invoiceNumber);
      imported += 1;
    }

    return NextResponse.json({
      scanned: quickBooksInvoices.length,
      imported,
      skippedDuplicates,
      unmatchedInvoices: Array.from(unmatchedCustomers.values())
        .reduce((sum, customer) => sum + customer.invoiceCount, 0),
      unmatchedCustomers: Array.from(unmatchedCustomers.values())
        .sort((left, right) => right.invoiceCount - left.invoiceCount),
      conflicts,
      errors,
    });
  } catch (error) {
    console.error('QuickBooks historical invoice import failed:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to import QuickBooks invoices' },
      { status: 500 }
    );
  }
}