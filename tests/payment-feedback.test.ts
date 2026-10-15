import { describe, expect, it } from "vitest";
import { describePaymentMethodFailure, getSavedCardLabel } from "@/lib/payment-feedback";

describe("payment method feedback", () => {
  it("shows the last four digits when available and a truthful fallback otherwise", () => {
    expect(getSavedCardLabel(null, "1234")).toBe("ending in 1234");
    expect(getSavedCardLabel("Business card", null)).toBe("Business card");
    expect(getSavedCardLabel(null, null)).toBe("Saved card");
    expect(getSavedCardLabel(null, "saved")).toBe("Saved card");
  });

  it("explains session errors with a concrete recovery step", () => {
    expect(describePaymentMethodFailure("Unauthorized")).toContain("sign in again");
  });

  it("preserves the provider detail for tokenization failures", () => {
    const result = describePaymentMethodFailure("Card declined by issuer");

    expect(result).toContain("Card declined by issuer");
    expect(result).toContain("another card");
  });

  it("explains secure-form loading failures", () => {
    expect(describePaymentMethodFailure("Failed to load payment form.")).toContain("connection");
  });
});
