import { describe, expect, it } from "vitest";
import { describePaymentMethodFailure } from "@/lib/payment-feedback";

describe("payment method feedback", () => {
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
