const fluidPaySecretKey = process.env.FLUIDPAY_SECRET_KEY ?? "";
const fluidPayBaseUrl = process.env.FLUIDPAY_BASE_URL || "https://sandbox.fluidpay.com";

if (!fluidPaySecretKey) {
  throw new Error("FLUIDPAY_SECRET_KEY is not configured");
}

interface FluidPayErrorResponse {
  message?: string;
  msg?: string;
  general_error?: string;
  detail?: string;
  error?: string;
  errors?: Array<{ message?: string }>;
}

interface FluidPayTransactionResponse {
  id?: string;
  status?: string;
  data?: {
    id?: string;
    status?: string;
    transaction_id?: string;
    response?: {
      id?: string;
      status?: string;
    };
  };
  transaction_id?: string;
  response?: {
    id?: string;
    status?: string;
  };
}

class FluidPayRequestError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "FluidPayRequestError";
    this.status = status;
  }
}

export interface FluidPayChargeResult {
  transactionId: string;
  status: string;
}

const getTransactionId = (payload: FluidPayTransactionResponse): string | null => {
  return payload.id ||
    payload.transaction_id ||
    payload.data?.id ||
    payload.data?.transaction_id ||
    payload.data?.response?.id ||
    payload.response?.id ||
    null;
};

const getTransactionStatus = (payload: FluidPayTransactionResponse): string | null => {
  return payload.status ||
    payload.data?.status ||
    payload.data?.response?.status ||
    payload.response?.status ||
    null;
};

const getFluidPayOrderId = (invoiceId: string): string => {
  return invoiceId.replace(/[^a-zA-Z0-9]/g, "").slice(-17);
};

const getErrorMessage = (payload: FluidPayErrorResponse): string => {
  if (payload.message) return payload.message;
  if (payload.msg) return payload.msg;
  if (payload.general_error) return payload.general_error;
  if (payload.detail) return payload.detail;
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
    throw new FluidPayRequestError(getErrorMessage(payload), response.status);
  }

  return payload;
}

export interface FluidPayVaultRecord {
  paymentMethodId: string;
  last4: string | null;
}

export async function createVaultRecord(token: string, customerId: string): Promise<FluidPayVaultRecord> {
  try {
    await fluidPayRequest(`/api/vault/customer`, {
      id: customerId,
      description: `North Shore Sign Co customer ${customerId}`,
    });
  } catch (error) {
    const isExistingCustomer = error instanceof FluidPayRequestError &&
      (error.status === 409 || error.message.toLowerCase().includes("customer already exists"));
    if (!isExistingCustomer) throw error;
  }

  const payload = await fluidPayRequest<{
    created_payment_method_id?: string;
    payment_method_id?: string;
    payment_method?: { id?: string; card?: { id?: string; last4?: string; last_four?: string; number?: string; masked_number?: string } };
    data?: {
      id?: string;
      created_payment_method_id?: string;
      payment_method_id?: string;
      payment_method?: { id?: string; card?: { id?: string; last4?: string; last_four?: string; number?: string; masked_number?: string } };
      data?: {
        id?: string;
        created_payment_method_id?: string;
        payment_method_id?: string;
        payment_method?: { id?: string; card?: { id?: string; last4?: string; last_four?: string; number?: string; masked_number?: string } };
      };
    };
    response?: {
      created_payment_method_id?: string;
      payment_method_id?: string;
      payment_method?: { id?: string; card?: { id?: string; last4?: string; last_four?: string; number?: string; masked_number?: string } };
    };
  }>(`/api/vault/customer/${customerId}/token?authorize=true`, { token });

  const paymentMethodId = payload.created_payment_method_id ||
    payload.payment_method_id ||
    payload.payment_method?.id ||
    payload.payment_method?.card?.id ||
    payload.data?.created_payment_method_id ||
    payload.data?.payment_method_id ||
    payload.data?.payment_method?.id ||
    payload.data?.payment_method?.card?.id ||
    payload.data?.data?.created_payment_method_id ||
    payload.data?.data?.payment_method_id ||
    payload.data?.data?.payment_method?.id ||
    payload.data?.data?.payment_method?.card?.id ||
    payload.response?.created_payment_method_id ||
    payload.response?.payment_method_id ||
    payload.response?.payment_method?.id ||
    payload.response?.payment_method?.card?.id ||
    payload.data?.id ||
    payload.data?.data?.id;

  if (!paymentMethodId) {
    throw new Error("FluidPay did not return a payment method ID");
  }

  const card = payload.payment_method?.card ||
    payload.data?.payment_method?.card ||
    payload.data?.data?.payment_method?.card ||
    payload.response?.payment_method?.card;
  const cardValue = card?.last4 || card?.last_four || card?.masked_number || card?.number || "";
  const last4 = /^\d{4}$/.test(cardValue) ? cardValue : cardValue.slice(-4).replace(/\D/g, "").slice(-4) || null;

  return { paymentMethodId, last4 };
}

export async function chargeVaultRecord(customerId: string, paymentMethodId: string, amountCents: number, invoiceId: string): Promise<FluidPayChargeResult> {
  const payload = await fluidPayRequest<FluidPayTransactionResponse>("/api/transaction", {
    type: "sale",
    amount: amountCents,
    payment_method: {
      customer: {
        id: customerId,
        payment_method_id: paymentMethodId,
      },
    },
    order_id: getFluidPayOrderId(invoiceId),
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
    order_id: getFluidPayOrderId(invoiceId),
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
