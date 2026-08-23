export const ORDER_STATUSES = [
  "PENDING",
  "CONFIRMED",
  "READY_TO_SCHEDULE",
  "SCHEDULED",
  "IN_GROUND",
  "EXTENDED_LISTING",
  "REMOVED",
  "CANCELLED",
] as const;

export type CanonicalOrderStatus = (typeof ORDER_STATUSES)[number];

export const ORDER_STATUS_LABELS: Record<CanonicalOrderStatus, string> = {
  PENDING: "Pending",
  CONFIRMED: "Confirmed",
  READY_TO_SCHEDULE: "Ready to Schedule",
  SCHEDULED: "Scheduled",
  IN_GROUND: "In Ground",
  EXTENDED_LISTING: "Extended Listing",
  REMOVED: "Removed",
  CANCELLED: "Cancelled",
};

export const ACTIVE_ORDER_STATUSES: CanonicalOrderStatus[] = [
  "PENDING",
  "CONFIRMED",
  "READY_TO_SCHEDULE",
  "SCHEDULED",
  "IN_GROUND",
  "EXTENDED_LISTING",
];

export const FULFILLED_ORDER_STATUSES: CanonicalOrderStatus[] = [
  "IN_GROUND",
  "EXTENDED_LISTING",
  "REMOVED",
];

interface UtilityLineLike {
  status?: unknown;
}

export function areAllUtilityLinesClear(utilityLines: unknown): boolean {
  return Array.isArray(utilityLines) &&
    utilityLines.length > 0 &&
    utilityLines.every(
      (line) => typeof line === "object" && line !== null && (line as UtilityLineLike).status === "CLEAR"
    );
}

export function orderRequires811(orderType: string): boolean {
  return orderType !== "REMOVAL";
}

export function isOrderReadyToSchedule(order: {
  type: string;
  self811Accepted?: boolean | null;
  ticket811?: { utilityLines?: unknown } | null;
}): boolean {
  if (!orderRequires811(order.type)) return true;
  if (order.self811Accepted) return true;
  return areAllUtilityLinesClear(order.ticket811?.utilityLines);
}

export function formatOrderStatus(status: string): string {
  return ORDER_STATUS_LABELS[status as CanonicalOrderStatus] ||
    status.toLowerCase().replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}