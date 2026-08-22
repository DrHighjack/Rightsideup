export interface InvoiceMoney {
  amount?: number | null;
  discountAmount?: number | null;
  taxAmount?: number | null;
  paidAmount?: number | null;
}

export function calculateTaxAmount(
  subtotalCents: number,
  discountCents: number,
  taxRateBps: number
): number {
  const taxableCents = Math.max(0, Math.round(subtotalCents) - Math.round(discountCents));
  return Math.round((taxableCents * taxRateBps) / 10000);
}

export function calculateInvoiceTotal(invoice: InvoiceMoney): number {
  return Math.max(
    0,
    Math.round(invoice.amount || 0) -
      Math.round(invoice.discountAmount || 0) +
      Math.round(invoice.taxAmount || 0)
  );
}

export function calculateInvoiceBalance(invoice: InvoiceMoney): number {
  return Math.max(0, calculateInvoiceTotal(invoice) - Math.round(invoice.paidAmount || 0));
}