export const BROKERAGE_AUTO_PAY_DELAY_HOURS = 24;

export function getBrokerageAutoPayScheduledAt(
  createdAt: Date,
  enabled: boolean,
  paymentMethodId: string | null
) {
  if (!enabled || !paymentMethodId) return null;
  return new Date(createdAt.getTime() + BROKERAGE_AUTO_PAY_DELAY_HOURS * 60 * 60 * 1000);
}