"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Search, Loader2 } from "lucide-react";

interface Result {
  id: string;
  title: string;
  slug: string;
  coverUrl: string | null;
  type: string;
  latestChapter: number | null;
}

export default function SearchBox({
  autoFocus = false,
  className = "",
  onNavigate,
}: {
  autoFocus?: boolean;
  className?: string;
  onNavigate?: () => void;
}) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(-1);
  const boxRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (autoFocus) inputRef.current?.focus(); }, [autoFocus]);

  // Debounced live search
  useEffect(() => {
    const term = q.trim();
    if (term.length < 1) { setResults([]); setOpen(false); setLoading(false); return; }
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(term)}&limit=6`, { cache: "no-store" });
        const data = await res.json();
        setResults(data.data ?? []);
        setOpen(true);
        setActive(-1);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  // Close on outside click
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const go = useCallback((href: string) => {
    setOpen(false);
    setQ("");
    onNavigate?.();
    router.push(href);
  }, [router, onNavigate]);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (active >= 0 && results[active]) { go(`/content/${results[active].slug}`); return; }
    if (q.trim()) go(`/discover?q=${encodeURIComponent(q.trim())}`);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (!open || results.length === 0) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => (a + 1) % results.length); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => (a <= 0 ? results.length - 1 : a - 1)); }
    else if (e.key === "Escape") { setOpen(false); }
  }

  return (
    <div ref={boxRef} className={`relative ${className}`}>
      <form onSubmit={onSubmit} className="flex items-center">
        <div className="relative w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-secondary)]" />
          <input
            ref={inputRef}
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={onKeyDown}
            onFocus={() => { if (results.length) setOpen(true); }}
            placeholder="ค้นหามังงะ..."
            className="w-full md:w-48 md:focus:w-64 bg-[var(--bg-card)] border border-[var(--border)] rounded-xl pl-9 pr-8 py-2 text-sm text-[var(--text-primary)] placeholder-gray-500 focus:outline-none focus:border-[var(--text-primary)]/50 transition-all"
          />
          {loading && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--text-secondary)] animate-spin" />}
        </div>
      </form>

      {open && (
        <div className="absolute left-0 right-0 mt-2 rounded-xl bg-[var(--bg-surface)] border border-[var(--border)] shadow-2xl overflow-hidden z-50 max-h-[70vh] overflow-y-auto">
          {results.length === 0 ? (
            <p className="px-4 py-3 text-sm text-[var(--text-secondary)] text-center">ไม่พบเรื่องที่ตรงกับ &ldquo;{q.trim()}&rdquo;</p>
          ) : (
            <>
              {results.map((r, i) => (
                <button
                  key={r.id}
                  onClick={() => go(`/content/${r.slug}`)}
                  onMouseEnter={() => setActive(i)}
                  className={`flex items-center gap-3 w-full text-left px-3 py-2 transition-colors ${i === active ? "bg-[var(--bg-card)]" : "hover:bg-[var(--bg-card)]"}`}
                >
                  <div className="relative w-9 h-12 rounded-md overflow-hidden bg-[var(--bg-card)] shrink-0">
                    {r.coverUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={r.coverUrl} alt="" className="w-full h-full object-cover" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-[var(--text-primary)] truncate">{r.title}</p>
                    <p className="text-xs text-[var(--text-secondary)]">
                      {r.type}{r.latestChapter != null ? ` · ตอนล่าสุด ${r.latestChapter}` : ""}
                    </p>
                  </div>
                </button>
              ))}
              <button
                onClick={() => go(`/discover?q=${encodeURIComponent(q.trim())}`)}
                className="w-full text-center px-3 py-2.5 text-xs font-medium text-[var(--text-primary)] border-t border-[var(--border)] hover:bg-[var(--bg-card)] transition-colors"
              >
                ดูผลการค้นหาทั้งหมด &ldquo;{q.trim()}&rdquo;
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
