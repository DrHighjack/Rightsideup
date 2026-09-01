import { describe, expect, it } from "vitest";
import {
  calculateInvoiceBalance,
  calculateInvoiceTotal,
  calculateTaxAmount,
  isOutstandingInvoiceStatus,
} from "@/lib/invoice-totals";

describe("invoice money math (integer cents)", () => {
  it("calculates totals as subtotal - discount + tax", () => {
    expect(calculateInvoiceTotal({ amount: 45000, discountAmount: 5000, taxAmount: 4000 })).toBe(44000);
  });

  it("never returns a negative total", () => {
    expect(calculateInvoiceTotal({ amount: 1000, discountAmount: 5000, taxAmount: 0 })).toBe(0);
  });

  it("treats null/undefined fields as zero", () => {
    expect(calculateInvoiceTotal({ amount: null, discountAmount: null, taxAmount: null })).toBe(0);
    expect(calculateInvoiceBalance({ amount: 2000, paidAmount: null })).toBe(2000);
  });

  it("calculates balance as total minus amount paid", () => {
    expect(
      calculateInvoiceBalance({ amount: 10000, discountAmount: 1000, taxAmount: 900, paidAmount: 4000 })
    ).toBe(5900);
  });

  it("floors balance at zero when overpaid", () => {
    expect(calculateInvoiceBalance({ amount: 1000, paidAmount: 5000 })).toBe(0);
  });

  it("calculates tax on the discounted subtotal using basis points", () => {
    // 10% tax (1000 bps) on $100.00 - $25.00 = $75.00 -> $7.50
    expect(calculateTaxAmount(10000, 2500, 1000)).toBe(750);
  });

  it("rounds tax to whole cents", () => {
    // 8.9% on 3333 cents -> 296.637 -> 297
    expect(calculateTaxAmount(3333, 0, 890)).toBe(297);
  });

  it("never taxes a negative taxable base", () => {
    expect(calculateTaxAmount(1000, 5000, 1000)).toBe(0);
  });

  it("identifies outstanding invoice statuses", () => {
    expect(isOutstandingInvoiceStatus("SENT")).toBe(true);
    expect(isOutstandingInvoiceStatus("OVERDUE")).toBe(true);
    expect(isOutstandingInvoiceStatus("PAID")).toBe(false);
    expect(isOutstandingInvoiceStatus("DRAFT")).toBe(false);
  });
});
