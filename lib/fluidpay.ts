const fluidPaySecretKey = process.env.FLUIDPAY_SECRET_KEY ?? "";
const fluidPayBaseUrl = process.env.FLUIDPAY_BASE_URL || "https://sandbox.fluidpay.com";

if (!fluidPaySecretKey) {
  throw new Error("FLUIDPAY_SECRET_KEY is not configured");
}

interface FluidPayErrorResponse {
  message?: string;
  error?: string;
  errors?: Array<{ message?: string }>;
}

interface FluidPayTransactionResponse {
  id?: string;
  status?: string;
  response?: {
    id?: string;
    status?: string;
  };
}

export interface FluidPayChargeResult {
  transactionId: string;
  status: string;
}

const getTransactionId = (payload: FluidPayTransactionResponse): string | null => {
  return payload.id || payload.response?.id || null;
};

const getTransactionStatus = (payload: FluidPayTransactionResponse): string | null => {
  return payload.status || payload.response?.status || null;
};

const getErrorMessage = (payload: FluidPayErrorResponse): string => {
  if (payload.message) return payload.message;
  if (payload.error) return payload.error;
  if (payload.errors && payload.errors[0]?.message) return payload.errors[0].message;
  return "FluidPay request failed";
};

async function fluidPayRequest<TResponse>(path: string, body: Record<string, unknown>, method = "POST"): Promise<TResponse> {
  const response = await fetch(`${fluidPayBaseUrl}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: fluidPaySecretKey,
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });

  const payload = (await response.json().catch(() => ({}))) as TResponse & FluidPayErrorResponse;

  if (!response.ok) {
    throw new Error(getErrorMessage(payload));
  }

  return payload;
}

export async function createVaultRecord(token: string, customerId: string): Promise<string> {
  const payload = await fluidPayRequest<FluidPayTransactionResponse>("/api/transaction", {
    type: "verification",
    amount: 0,
    create_vault_record: true,
    customer_id: customerId,
    payment_method: {
      token,
    },
  });

  const vaultId = (payload as unknown as { vault_id?: string; response?: { vault_id?: string } }).vault_id ||
    (payload as unknown as { response?: { vault_id?: string } }).response?.vault_id;

  if (!vaultId) {
    throw new Error("FluidPay did not return a vault_id");
  }

  return vaultId;
}

export async function chargeVaultRecord(vaultId: string, amountCents: number, invoiceId: string): Promise<FluidPayChargeResult> {
  const payload = await fluidPayRequest<FluidPayTransactionResponse>("/api/transaction", {
    type: "sale",
    amount: amountCents,
    payment_method: {
      vault_id: vaultId,
    },
    order_id: invoiceId,
  });

  const transactionId = getTransactionId(payload);
  const status = getTransactionStatus(payload);

  if (!transactionId || !status) {
    throw new Error("FluidPay did not return transaction id/status");
  }

  return { transactionId, status };
}

export async function chargeToken(token: string, amountCents: number, invoiceId: string): Promise<FluidPayChargeResult> {
  const payload = await fluidPayRequest<FluidPayTransactionResponse>("/api/transaction", {
    type: "sale",
    amount: amountCents,
    payment_method: {
      token,
    },
    order_id: invoiceId,
  });

  const transactionId = getTransactionId(payload);
  const status = getTransactionStatus(payload);

  if (!transactionId || !status) {
    throw new Error("FluidPay did not return transaction id/status");
  }

  return { transactionId, status };
}

export async function refundTransaction(transactionId: string, amountCents: number): Promise<FluidPayChargeResult> {
  const payload = await fluidPayRequest<FluidPayTransactionResponse>(`/api/transaction/${transactionId}/refund`, {
    amount: amountCents,
  });

  const refundTransactionId = getTransactionId(payload);
  const status = getTransactionStatus(payload);

  if (!refundTransactionId || !status) {
    throw new Error("FluidPay did not return refund transaction id/status");
  }

  return { transactionId: refundTransactionId, status };
}
