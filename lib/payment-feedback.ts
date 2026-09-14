export function describePaymentMethodFailure(message?: string): string {
  const detail = message?.trim() || "No additional detail was returned.";
  const normalized = detail.toLowerCase();

  if (normalized.includes("unauthorized") || normalized.includes("forbidden")) {
    return "Your login session has expired. Refresh the page, sign in again, and retry.";
  }
  if (normalized.includes("public key") || normalized.includes("apikey")) {
    return "The secure card form is not configured correctly. Please contact North Shore Sign Co.";
  }
  if (normalized.includes("token") || normalized.includes("tokeniz")) {
    return `FluidPay could not securely validate this card. Check the card number, expiration, and CVV, then retry. Details: ${detail}`;
  }
  if (normalized.includes("network") || normalized.includes("fetch") || normalized.includes("load")) {
    return "The secure card service could not be reached. Check your connection, refresh the page, and try again.";
  }
  if (normalized.includes("vault") || normalized.includes("payment method")) {
    return `FluidPay could not save this card. Please try another card or contact North Shore Sign Co. Details: ${detail}`;
  }

  return `We could not save your card. Please retry or use another card. Details: ${detail}`;
}
