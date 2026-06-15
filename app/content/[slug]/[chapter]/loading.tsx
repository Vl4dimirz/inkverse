// Shown instantly while the reader page renders on the server, so tapping into a
// chapter feels immediate instead of hanging on the previous page.
export default function Loading() {
  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      {/* Top bar */}
      <div className="sticky top-0 z-40 bg-[var(--bg-primary)]/95 backdrop-blur border-b border-[var(--border)]">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="h-4 w-16 bg-[var(--bg-surface)] rounded animate-pulse" />
          <div className="h-4 w-20 bg-[var(--bg-surface)] rounded animate-pulse" />
          <div className="h-4 w-12 bg-[var(--bg-surface)] rounded animate-pulse" />
        </div>
      </div>

      {/* Page placeholders */}
      <div className="max-w-4xl mx-auto flex flex-col items-center">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="skeleton w-full" style={{ aspectRatio: "800 / 1200" }} />
        ))}
      </div>
    </div>
  );
}
