export const DEFAULT_FLUIDPAY_PUBLIC_KEY = "pub_3IFJ9AyNLIrn8p5tWxOuu99Wgqa";
export const DEFAULT_FLUIDPAY_BASE_URL = "https://app.fluidpay.com";

type FluidPayEnvironment = Record<string, string | undefined>;

function normalizeBaseUrl(value: string) {
  return value.trim().replace(/\/+$/, "").toLowerCase();
}

export function getFluidPayBrowserConfig(environment: FluidPayEnvironment = process.env) {
  const publicKey = environment.NEXT_PUBLIC_FLUIDPAY_PUBLIC_KEY?.trim() || DEFAULT_FLUIDPAY_PUBLIC_KEY;
  const baseUrl = environment.NEXT_PUBLIC_FLUIDPAY_BASE_URL?.trim() || DEFAULT_FLUIDPAY_BASE_URL;
  const serverBaseUrl = environment.FLUIDPAY_BASE_URL?.trim() || DEFAULT_FLUIDPAY_BASE_URL;

  return {
    publicKey,
    baseUrl,
    configurationError: normalizeBaseUrl(baseUrl) === normalizeBaseUrl(serverBaseUrl)
      ? null
      : "FluidPay's hosted form and secure vault use different environments. Contact support before saving a card.",
  };
}