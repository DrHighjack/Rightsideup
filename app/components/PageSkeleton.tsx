interface PageSkeletonProps {
  variant?: "dashboard" | "list" | "detail" | "form";
}

const rows = Array.from({ length: 6 });

export default function PageSkeleton({ variant = "list" }: PageSkeletonProps) {
  if (variant === "dashboard") {
    return (
      <div className="animate-pulse space-y-6" aria-busy="true" aria-label="Loading dashboard">
        <div className="space-y-2">
          <div className="h-8 w-64 rounded bg-slate-200" />
          <div className="h-4 w-80 max-w-full rounded bg-slate-100" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => <div key={index} className="h-28 rounded-xl border border-slate-200 bg-white" />)}
        </div>
        <div className="h-72 rounded-xl border border-slate-200 bg-white" />
      </div>
    );
  }

  if (variant === "detail") {
    return (
      <div className="animate-pulse space-y-6" aria-busy="true" aria-label="Loading details">
        <div className="space-y-3">
          <div className="h-4 w-32 rounded bg-slate-200" />
          <div className="h-9 w-72 max-w-full rounded bg-slate-200" />
        </div>
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="h-96 rounded-xl border border-slate-200 bg-white lg:col-span-2" />
          <div className="h-72 rounded-xl border border-slate-200 bg-white" />
        </div>
      </div>
    );
  }

  if (variant === "form") {
    return (
      <div className="animate-pulse space-y-6" aria-busy="true" aria-label="Loading form">
        <div className="space-y-2">
          <div className="h-8 w-56 rounded bg-slate-200" />
          <div className="h-4 w-72 max-w-full rounded bg-slate-100" />
        </div>
        <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-6">
          {Array.from({ length: 5 }).map((_, index) => <div key={index} className="h-12 rounded-lg bg-slate-100" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="animate-pulse space-y-6" aria-busy="true" aria-label="Loading list">
      <div className="space-y-2">
        <div className="h-8 w-56 rounded bg-slate-200" />
        <div className="h-4 w-72 max-w-full rounded bg-slate-100" />
      </div>
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="h-12 border-b border-slate-200 bg-slate-50" />
        {rows.map((_, index) => <div key={index} className="h-16 border-b border-slate-100 last:border-0" />)}
      </div>
    </div>
  );
}
