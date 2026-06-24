export default function Loading() {
  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
      <div className="h-9 w-48 bg-[var(--bg-surface)] rounded animate-pulse mb-6" />
      {/* stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border)] animate-pulse" />
        ))}
      </div>
      {/* works list */}
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex gap-3 p-3 rounded-xl bg-[var(--bg-surface)] border border-[var(--border)]">
            <div className="w-14 h-20 rounded bg-[var(--bg-card)] animate-pulse shrink-0" />
            <div className="flex-1 space-y-2 py-1">
              <div className="h-4 w-40 bg-[var(--bg-card)] rounded animate-pulse" />
              <div className="h-3 w-24 bg-[var(--bg-card)] rounded animate-pulse" />
              <div className="h-3 w-32 bg-[var(--bg-card)] rounded animate-pulse" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
