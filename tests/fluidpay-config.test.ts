import { describe, expect, it } from "vitest";
import { DEFAULT_FLUIDPAY_BASE_URL, getFluidPayBrowserConfig } from "@/lib/fluidpay-config";

describe("FluidPay browser configuration", () => {
  it("does not use the server-only sandbox base as the browser default", () => {
    const config = getFluidPayBrowserConfig({ FLUIDPAY_BASE_URL: "https://sandbox.fluidpay.com" });

    expect(config.baseUrl).toBe(DEFAULT_FLUIDPAY_BASE_URL);
    expect(config.configurationError).toContain("different environments");
  });

  it("uses an explicitly configured public key and base URL", () => {
    const config = getFluidPayBrowserConfig({
      NEXT_PUBLIC_FLUIDPAY_PUBLIC_KEY: "pub-live-key",
      NEXT_PUBLIC_FLUIDPAY_BASE_URL: "https://app.fluidpay.com/",
      FLUIDPAY_BASE_URL: "https://app.fluidpay.com",
    });

    expect(config).toEqual({
      publicKey: "pub-live-key",
      baseUrl: "https://app.fluidpay.com/",
      configurationError: null,
    });
  });

  it("reports a frontend/backend environment mismatch without exposing credentials", () => {
    const config = getFluidPayBrowserConfig({
      NEXT_PUBLIC_FLUIDPAY_PUBLIC_KEY: "pub-live-key",
      NEXT_PUBLIC_FLUIDPAY_BASE_URL: "https://app.fluidpay.com",
      FLUIDPAY_BASE_URL: "https://sandbox.fluidpay.com",
      FLUIDPAY_SECRET_KEY: "never-return-this",
    });

    expect(config.configurationError).toContain("different environments");
    expect(JSON.stringify(config)).not.toContain("never-return-this");
  });
});