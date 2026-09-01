import { describe, expect, it } from "vitest";
import { z } from "zod";
import { getIdentifier } from "@/lib/ratelimit";
import { adminInvoiceCreateSchema, invoicePaySchema, paymentChargeSchema } from "@/lib/schemas";

describe("getIdentifier", () => {
  it("prefers user IDs over IPs", () => {
    expect(getIdentifier("1.2.3.4", "user-1")).toBe("user:user-1");
  });

  it("falls back to IP, then unknown", () => {
    expect(getIdentifier("1.2.3.4")).toBe("ip:1.2.3.4");
    expect(getIdentifier()).toBe("ip:unknown");
  });
});

describe("invoice schemas", () => {
  it("rejects an invoice without an amount or line items", () => {
    expect(() =>
      adminInvoiceCreateSchema.parse({ userId: "u1", discountAmount: 0, taxRateBps: 0 })
    ).toThrow(z.ZodError);
  });

  it("accepts a valid invoice with line items", () => {
    const parsed = adminInvoiceCreateSchema.parse({
      userId: "u1",
      lineItems: [{ description: "Install", quantity: 1, unitAmount: 4500 }],
      discountAmount: 0,
      taxRateBps: 0,
    });
    expect(parsed.lineItems?.[0].unitAmount).toBe(4500);
  });

  it("rejects negative discounts", () => {
    expect(() =>
      adminInvoiceCreateSchema.parse({ userId: "u1", amount: 1000, discountAmount: -5 })
    ).toThrow(z.ZodError);
  });

  it("validates payment payloads", () => {
    expect(() => invoicePaySchema.parse({ paymentCardId: " ", payerType: "AGENT" })).toThrow(z.ZodError);
    expect(() =>
      paymentChargeSchema.parse({ invoiceId: "", token: "tok", useVault: false })
    ).toThrow(z.ZodError);
  });
});

describe("magic-login redirect guard", () => {
  const guard = (raw: string | null) =>
    raw && raw.startsWith("/") && !raw.startsWith("//") && !raw.includes("://") ? raw : "/dashboard";

  it("allows relative in-app paths", () => {
    expect(guard("/dashboard")).toBe("/dashboard");
    expect(guard("/dashboard/orders/123?tab=photos")).toBe("/dashboard/orders/123?tab=photos");
  });

  it("blocks external and protocol-relative URLs", () => {
    expect(guard("https://evil.example.com")).toBe("/dashboard");
    expect(guard("//evil.example.com")).toBe("/dashboard");
    expect(guard("javascript:alert(1)")).toBe("/dashboard");
  });

  it("falls back when missing", () => {
    expect(guard(null)).toBe("/dashboard");
  });
});
