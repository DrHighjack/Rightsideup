// Server-side FluidPay client. Card data never touches our servers — the
// browser exchanges it for a single-use token via FluidPay's hosted
// Tokenizer fields, and we charge that token here.
//
// Env:
//   FLUIDPAY_API_KEY                 secret API key (server only)
//   NEXT_PUBLIC_FLUIDPAY_PUBLIC_KEY  public tokenizer key (browser)
//   FLUIDPAY_BASE_URL                default https://app.fluidpay.com
//                                    (use https://sandbox.fluidpay.com to test)
//   FLUIDPAY_WEBHOOK_SECRET          signature key from the webhook config

export function getFluidPayBaseUrl(): string {
  return (process.env.FLUIDPAY_BASE_URL || "https://app.fluidpay.com").replace(/\/+$/, "");
}

export function isFluidPayConfigured(): boolean {
  return Boolean(process.env.FLUIDPAY_API_KEY);
}

export interface FluidPaySaleResult {
  ok: boolean;
  transactionId?: string;
  gatewayStatus?: string;
  cardLast4?: string;
  cardType?: string;
  declineReason?: string;
  raw: unknown;
}

// Gateway statuses that mean the charge went through. A card sale lands in
// "pending_settlement" immediately after approval and moves to "settled"
// in the nightly batch.
const SUCCESS_STATUSES = new Set(["approved", "pending_settlement", "settled"]);

export async function createFluidPaySale(params: {
  amountCents: number;
  token: string;
  orderId?: string;
  description?: string;
  email?: string;
}): Promise<FluidPaySaleResult> {
  const apiKey = process.env.FLUIDPAY_API_KEY;
  if (!apiKey) {
    return { ok: false, declineReason: "FluidPay is not configured", raw: null };
  }
  if (!Number.isInteger(params.amountCents) || params.amountCents <= 0) {
    return { ok: false, declineReason: "Invalid amount", raw: null };
  }

  const res = await fetch(`${getFluidPayBaseUrl()}/api/transaction`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: apiKey,
    },
    body: JSON.stringify({
      type: "sale",
      amount: params.amountCents,
      currency: "USD",
      email_receipt: false,
      email_address: params.email || undefined,
      order_id: params.orderId || undefined,
      description: params.description || undefined,
      payment_method: { token: params.token },
    }),
    // Payment calls must not hang forever behind a flaky gateway
    signal: AbortSignal.timeout(30_000),
  });

  let json: any = null;
  try {
    json = await res.json();
  } catch {
    return {
      ok: false,
      declineReason: `Gateway returned an unreadable response (HTTP ${res.status})`,
      raw: { httpStatus: res.status },
    };
  }

  const data = json?.data;
  const gatewayStatus: string | undefined = data?.status;
  const card = data?.response_body?.card;

  const ok =
    res.ok &&
    json?.status === "success" &&
    typeof gatewayStatus === "string" &&
    SUCCESS_STATUSES.has(gatewayStatus);

  return {
    ok,
    transactionId: data?.id,
    gatewayStatus,
    cardLast4: card?.last_four || card?.masked_card?.slice(-4),
    cardType: card?.card_type,
    declineReason: ok
      ? undefined
      : data?.response ||
        json?.msg ||
        (gatewayStatus ? `Card ${gatewayStatus}` : `Payment failed (HTTP ${res.status})`),
    raw: json,
  };
}
