export default function Loading() {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
      <div className="h-9 w-56 bg-[var(--bg-surface)] rounded animate-pulse mb-6" />
      <div className="space-y-2">
        {Array.from({ length: 12 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-3 p-3 rounded-xl bg-[var(--bg-surface)] border border-[var(--border)]"
          >
            <div className="w-7 h-7 rounded bg-[var(--bg-card)] animate-pulse shrink-0" />
            <div className="w-10 h-10 rounded-full bg-[var(--bg-card)] animate-pulse shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="h-3.5 w-32 bg-[var(--bg-card)] rounded animate-pulse" />
              <div className="h-3 w-20 bg-[var(--bg-card)] rounded animate-pulse" />
            </div>
            <div className="h-4 w-12 bg-[var(--bg-card)] rounded animate-pulse" />
          </div>
        ))}
      </div>
    </div>
  );
}
