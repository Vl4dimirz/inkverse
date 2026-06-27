"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { Trophy, X } from "lucide-react";

interface Toast {
  id: string;
  title: string;
  body: string;
}

const LS_KEY = "inkverse_toasted_ach";
const FRESH_MS = 10 * 60 * 1000; // only pop achievements unlocked in the last 10 min
const FETCH_THROTTLE_MS = 90 * 1000; // at most one /api/notifications hit per 90s

// Module-level so it survives client navigations (the component stays mounted in
// the layout). Throttles the per-route-change fetch — without this, a user
// browsing N pages fired N notification queries, a real DB-compute drain.
let lastToasterFetch = 0;

/**
 * Pops a toast when an achievement unlocks. Reads ACHIEVEMENT notifications
 * (created server-side on unlock), dedupes via localStorage, and re-checks on
 * route change (throttled) so a chapter-read unlock pops as you move around.
 */
export default function AchievementToaster() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const pathname = usePathname();

  useEffect(() => {
    // Skip if we fetched recently — caps notification queries under heavy nav.
    if (Date.now() - lastToasterFetch < FETCH_THROTTLE_MS) return;
    lastToasterFetch = Date.now();
    let alive = true;
    fetch("/api/notifications")
      .then((r) => (r.ok ? r.json() : { notifications: [] }))
      .then((d: { notifications?: { id: string; type: string; title: string; body: string; createdAt: string }[] }) => {
        if (!alive) return;
        let seen: string[] = [];
        try {
          seen = JSON.parse(localStorage.getItem(LS_KEY) || "[]");
        } catch {
          seen = [];
        }
        const seenSet = new Set(seen);
        const now = Date.now();
        const fresh = (d.notifications ?? []).filter(
          (n) =>
            n.type === "ACHIEVEMENT" &&
            !seenSet.has(n.id) &&
            now - new Date(n.createdAt).getTime() < FRESH_MS
        );
        if (fresh.length === 0) return;

        const newToasts = fresh.slice(0, 3).map((n) => ({ id: n.id, title: n.title, body: n.body }));
        setToasts((t) => [...t, ...newToasts]);

        const updated = [...seen, ...fresh.map((n) => n.id)].slice(-200);
        try {
          localStorage.setItem(LS_KEY, JSON.stringify(updated));
        } catch {
          /* ignore */
        }

        newToasts.forEach((nt) =>
          setTimeout(() => {
            setToasts((t) => t.filter((x) => x.id !== nt.id));
          }, 7000)
        );
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [pathname]);

  const dismiss = (id: string) => setToasts((t) => t.filter((x) => x.id !== id));

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 w-[300px] max-w-[calc(100vw-2rem)]">
      {toasts.map((t) => (
        <Link
          key={t.id}
          href="/achievements"
          onClick={() => dismiss(t.id)}
          className="group relative flex items-start gap-3 bg-[var(--bg-surface)] border border-[var(--text-primary)]/40 p-3.5 shadow-xl fade-in"
        >
          <div className="w-9 h-9 flex items-center justify-center bg-[var(--text-primary)] text-[var(--bg-primary)] shrink-0">
            <Trophy className="w-4 h-4" />
          </div>
          <div className="min-w-0 flex-1 pr-4">
            <p className="text-xs font-semibold text-[var(--text-primary)] uppercase tracking-wide">
              {t.title}
            </p>
            <p className="text-xs text-[var(--text-secondary)] mt-0.5 line-clamp-2">{t.body}</p>
          </div>
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              dismiss(t.id);
            }}
            aria-label="ปิด"
            className="absolute top-2 right-2 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </Link>
      ))}
    </div>
  );
}
