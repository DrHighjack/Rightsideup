export type AutoInvoiceInterval = "MONTHLY" | "BIWEEKLY";

export function isAutoInvoiceInterval(value: unknown): value is AutoInvoiceInterval {
  return value === "MONTHLY" || value === "BIWEEKLY";
}

export function getNextAutoInvoiceRun(interval: AutoInvoiceInterval, from: Date): Date {
  if (interval === "BIWEEKLY") {
    const nextRun = new Date(from);
    nextRun.setUTCDate(nextRun.getUTCDate() + 14);
    return new Date(Date.UTC(
      nextRun.getUTCFullYear(),
      nextRun.getUTCMonth(),
      nextRun.getUTCDate(),
      9
    ));
  }

  const lastDayOfCurrentMonth = new Date(Date.UTC(
    from.getUTCFullYear(),
    from.getUTCMonth() + 1,
    0
  )).getUTCDate();
  if (from.getUTCDate() === lastDayOfCurrentMonth) {
    return new Date(Date.UTC(
      from.getUTCFullYear(),
      from.getUTCMonth() + 2,
      0,
      9
    ));
  }

  return new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth() + 1, 1, 9));
}

export function getAutoInvoicePeriodStart(from: Date): Date {
  return new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate()));
}
