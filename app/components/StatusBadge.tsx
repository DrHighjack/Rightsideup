import { formatOrderStatus } from "@/lib/order-status";

const STATUS_STYLES: Record<string, { pill: string; dot: string }> = {
  PENDING: { pill: "bg-amber-50 text-amber-700 ring-amber-600/20", dot: "bg-amber-500" },
  CONFIRMED: { pill: "bg-sky-50 text-sky-700 ring-sky-600/20", dot: "bg-sky-500" },
  READY_TO_SCHEDULE: { pill: "bg-teal-50 text-teal-700 ring-teal-600/20", dot: "bg-teal-500" },
  SCHEDULED: { pill: "bg-blue-50 text-blue-700 ring-blue-600/20", dot: "bg-blue-500" },
  IN_GROUND: { pill: "bg-cyan-50 text-cyan-700 ring-cyan-600/20", dot: "bg-cyan-500" },
  EXTENDED_LISTING: { pill: "bg-indigo-50 text-indigo-700 ring-indigo-600/20", dot: "bg-indigo-500" },
  REMOVED: { pill: "bg-emerald-50 text-emerald-700 ring-emerald-600/20", dot: "bg-emerald-500" },
  CANCELLED: { pill: "bg-red-50 text-red-700 ring-red-600/20", dot: "bg-red-500" },
};

const FALLBACK = { pill: "bg-slate-50 text-slate-700 ring-slate-600/20", dot: "bg-slate-400" };

export default function StatusBadge({ status }: { status: string }) {
  const style = STATUS_STYLES[status] || FALLBACK;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${style.pill}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${style.dot}`} />
      {formatOrderStatus(status)}
    </span>
  );
}
