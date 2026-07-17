function Shimmer({ className }: { className: string }) {
  return (
    <div className={`relative overflow-hidden rounded-md bg-slate-200/70 ${className}`}>
      <div className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-white/50 to-transparent" />
    </div>
  );
}

export default function DashboardLoading() {
  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <Shimmer className="h-8 w-64" />
        <Shimmer className="h-4 w-80" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[0, 1, 2].map((i) => (
          <div key={i} className="bg-white rounded-xl border border-slate-200 p-6 space-y-3 shadow-card">
            <Shimmer className="h-4 w-32" />
            <Shimmer className="h-8 w-16" />
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4 shadow-card">
        <Shimmer className="h-5 w-32" />
        <div className="space-y-3">
          {[0, 1, 2, 3, 4].map((i) => (
            <Shimmer key={i} className="h-6 w-full" />
          ))}
        </div>
      </div>
    </div>
  );
}
