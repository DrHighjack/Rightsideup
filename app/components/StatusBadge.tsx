const STATUS_STYLES: Record<string, { pill: string; dot: string }> = {
  PENDING: { pill: "bg-amber-50 text-amber-700 ring-amber-600/20", dot: "bg-amber-500" },
  SCHEDULED: { pill: "bg-blue-50 text-blue-700 ring-blue-600/20", dot: "bg-blue-500" },
  IN_PROGRESS: { pill: "bg-violet-50 text-violet-700 ring-violet-600/20", dot: "bg-violet-500" },
  IN_GROUND: { pill: "bg-cyan-50 text-cyan-700 ring-cyan-600/20", dot: "bg-cyan-500" },
  ON_HOLD: { pill: "bg-orange-50 text-orange-700 ring-orange-600/20", dot: "bg-orange-500" },
  COMPLETED: { pill: "bg-emerald-50 text-emerald-700 ring-emerald-600/20", dot: "bg-emerald-500" },
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
      {status.replace(/_/g, " ")}
    </span>
  );
}
