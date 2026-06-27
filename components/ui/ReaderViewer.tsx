"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { ChevronLeft, ChevronRight, ChevronDown, Settings, AlignJustify, BookOpen } from "lucide-react";
import clsx from "clsx";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { isLikelyAutomated } from "@/lib/botCheck";
import DownloadChapterButton from "./DownloadChapterButton";

interface Page {
  pageNum: number;
  src: string; // signed proxy URL (/api/img/<id>?e=&s=)
  width?: number | null;
  height?: number | null;
}

interface ReaderViewerProps {
  pages: Page[];
  chapterNum: number;
  mangaSlug: string;
  prevChapter?: number | null;
  nextChapter?: number | null;
  onPageChange?: (page: number) => void;
  // When set, shows the "download for offline" button in the top bar.
  chapterId?: string;
  mangaTitle?: string;
  coverUrl?: string;
  // When set, the top-bar back control calls this instead of linking out
  // (used by the offline library reader, which has no server route to go to).
  onBack?: () => void;
  // 1-based page to resume at (persisted reading position). Defaults to 1.
  initialPage?: number;
  // Full ordered chapter list for the in-reader "jump to chapter" dropdown.
  chapters?: { num: number; title: string | null }[];
}

const clampN = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const touchDist = (a: React.Touch, b: React.Touch) =>
  Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);

// Renders a manga page onto a <canvas> instead of an <img>. The signed image is
// fetched as a blob, decoded into an off-DOM Image, painted to the canvas, then
// the blob URL is revoked — so there's no <img> element or usable URL to save,
// drag, or scrape. Lazy-loads ~1200px before view and RELEASES the canvas buffer
// when it scrolls far away, so long chapters stay light on memory.
function MangaCanvas({
  source,
  alt,
  w,
  h,
  full,
  priority,
  registerRef,
}: {
  source: string;
  alt: string;
  w: number;
  h: number;
  full: boolean;
  priority?: boolean;
  // Lets the parent track the wrapper element (webtoon resume + scroll progress).
  registerRef?: (el: HTMLDivElement | null) => void;
}) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawn = useRef(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    let cancelled = false;

    const draw = () => {
      if (drawn.current || cancelled) return;
      // Don't paint pages for headless/automation — a canvas never drawn can't be
      // screenshotted by a bot. Real readers are unaffected (see lib/botCheck).
      if (isLikelyAutomated()) return;
      drawn.current = true;
      (async () => {
        let url: string | null = null;
        try {
          const res = await fetch(source);
          if (!res.ok || cancelled) {
            drawn.current = false;
            return;
          }
          const blob = await res.blob();
          url = URL.createObjectURL(blob);
          const img = new Image();
          img.decoding = "async";
          await new Promise<void>((resolve, reject) => {
            img.onload = () => resolve();
            img.onerror = () => reject(new Error("decode"));
            img.src = url as string;
          });
          const canvas = canvasRef.current;
          if (cancelled || !canvas) return;
          const maxW = 1280; // cap internal resolution to bound memory
          const scale = img.naturalWidth > maxW ? maxW / img.naturalWidth : 1;
          canvas.width = Math.round(img.naturalWidth * scale) || w;
          canvas.height = Math.round(img.naturalHeight * scale) || h;
          canvas.getContext("2d")?.drawImage(img, 0, 0, canvas.width, canvas.height);
          if (!cancelled) setReady(true);
        } catch {
          drawn.current = false;
        } finally {
          if (url) URL.revokeObjectURL(url); // painted into the canvas now
        }
      })();
    };

    const release = () => {
      const canvas = canvasRef.current;
      if (canvas) {
        canvas.width = 0;
        canvas.height = 0;
      }
      drawn.current = false;
      setReady(false);
    };

    if (priority) {
      draw();
      return () => {
        cancelled = true;
      };
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) (e.isIntersecting ? draw : release)();
      },
      // Asymmetric preload: load pages well before they scroll INTO view (large
      // bottom margin = read downward stays ahead of the scroll, no skeleton),
      // but keep a smaller top margin so passed pages release sooner to save
      // memory. ~4 screens ahead, ~1 behind.
      { rootMargin: "900px 0px 4000px 0px" }
    );
    io.observe(wrap);
    return () => {
      cancelled = true;
      io.disconnect();
      release();
    };
  }, [source, priority, w, h]);

  return (
    <div
      ref={(el) => {
        wrapRef.current = el;
        registerRef?.(el);
      }}
      // Webtoon pages stack vertically; `aspect-ratio` yields fractional heights
      // that WebKit/iOS rounds inconsistently, leaving a hairline gap between
      // pages. Overlap each page 1px (-mb-px) so the seam disappears. Desktop
      // Chrome rounds differently and never showed it.
      className={full ? "relative w-full block -mb-px" : "relative"}
      style={full ? { aspectRatio: `${w} / ${h}` } : { aspectRatio: `${w} / ${h}`, height: "calc(100vh - 140px)" }}
    >
      <canvas
        ref={canvasRef}
        aria-label={alt}
        onContextMenu={(e) => e.preventDefault()}
        className="absolute inset-0 w-full h-full object-contain select-none"
        style={{ visibility: ready ? "visible" : "hidden" }}
      />
      {!ready && <div className="skeleton absolute inset-0" />}
    </div>
  );
}

export default function ReaderViewer({
  pages,
  chapterNum,
  mangaSlug,
  prevChapter,
  nextChapter,
  onPageChange,
  chapterId,
  mangaTitle,
  coverUrl,
  onBack,
  initialPage,
  chapters,
}: ReaderViewerProps) {
  const router = useRouter();
  const [mode, setMode] = useState<"webtoon" | "page">("webtoon");
  const [currentPage, setCurrentPage] = useState(() =>
    clampN((initialPage ?? 1) - 1, 0, Math.max(0, pages.length - 1))
  );
  const [brightness, setBrightness] = useState(100);
  const [showSettings, setShowSettings] = useState(false);
  const [showChapters, setShowChapters] = useState(false);
  const [direction, setDirection] = useState<"ltr" | "rtl">("ltr");
  // Pinch-zoom state (page mode only).
  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });

  // Webtoon page wrappers — for resume-scroll + in-view progress tracking.
  const pageEls = useRef<(HTMLDivElement | null)[]>([]);
  const zoomElRef = useRef<HTMLDivElement | null>(null);
  const didResume = useRef(false);

  // Gesture refs (page mode).
  const tStart = useRef<{ x: number; y: number; t: number } | null>(null);
  const moved = useRef(false);
  const pinch = useRef<{ dist: number; base: number } | null>(null);
  const panStart = useRef<{ x: number; y: number; px: number; py: number } | null>(null);
  const lastTap = useRef(0);

  // Reading-progress persistence refs.
  const pendingPage = useRef(initialPage ?? 1);
  const lastSent = useRef(initialPage ?? 1);

  const goTo = useCallback(
    (idx: number) => {
      const clamped = clampN(idx, 0, pages.length - 1);
      setCurrentPage(clamped);
      onPageChange?.(clamped + 1);
    },
    [pages.length, onPageChange]
  );
  const flip = useCallback((d: number) => goTo(currentPage + d), [goTo, currentPage]);

  // ── Persisted reading direction (page mode) ──────────────────────────────
  useEffect(() => {
    try {
      const d = localStorage.getItem("ivReaderDir");
      if (d === "rtl" || d === "ltr") setDirection(d);
    } catch {}
  }, []);
  const changeDir = (d: "ltr" | "rtl") => {
    setDirection(d);
    try {
      localStorage.setItem("ivReaderDir", d);
    } catch {}
  };

  // Reset zoom whenever the page or mode changes.
  useEffect(() => {
    setScale(1);
    setPan({ x: 0, y: 0 });
  }, [currentPage, mode]);

  // ── Resume scroll position (webtoon) ─────────────────────────────────────
  useEffect(() => {
    if (didResume.current) return;
    if (mode === "webtoon" && (initialPage ?? 1) > 1) {
      didResume.current = true;
      const el = pageEls.current[(initialPage ?? 1) - 1];
      if (el) requestAnimationFrame(() => el.scrollIntoView({ block: "start" }));
    }
  }, [mode, initialPage]);

  // ── Reading-progress reporting ───────────────────────────────────────────
  // Don't write to the DB while reading — on a free Neon tier that's a flood of
  // tiny writes under load. Just remember the latest page; it's persisted ONCE
  // on tab-hide / unmount via sendBeacon (below), which is all "resume" needs.
  const report = useCallback(
    (page: number) => {
      if (!chapterId || onBack) return;
      pendingPage.current = page;
    },
    [chapterId, onBack]
  );

  // Flush the latest page on tab-hide / unmount so a quick exit still saves.
  useEffect(() => {
    const flush = () => {
      const p = pendingPage.current;
      if (!chapterId || onBack || !p || p === lastSent.current) return;
      lastSent.current = p;
      const body = JSON.stringify({ chapterId, page: p });
      try {
        if (navigator.sendBeacon) {
          navigator.sendBeacon("/api/reading-progress", new Blob([body], { type: "application/json" }));
        } else {
          fetch("/api/reading-progress", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body,
            keepalive: true,
          }).catch(() => {});
        }
      } catch {}
    };
    const onVis = () => {
      if (document.visibilityState === "hidden") flush();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      flush();
    };
  }, [chapterId, onBack]);

  // Page mode: report whenever the current page changes.
  useEffect(() => {
    if (mode === "page") report(currentPage + 1);
  }, [currentPage, mode, report]);

  // Webtoon mode: report the top-most page currently in view (throttled to rAF).
  useEffect(() => {
    if (mode !== "webtoon" || !chapterId || onBack) return;
    let raf = 0;
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const els = pageEls.current;
        let top = 1;
        for (let i = 0; i < els.length; i++) {
          const el = els[i];
          if (el && el.getBoundingClientRect().top <= 120) top = i + 1;
          else break;
        }
        report(top);
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [mode, chapterId, onBack, report]);

  // ── Keyboard nav (page mode), horizontal keys respect reading direction ──
  useEffect(() => {
    if (mode !== "page") return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown") goTo(currentPage + 1);
      else if (e.key === "ArrowUp") goTo(currentPage - 1);
      else if (e.key === "ArrowRight") goTo(currentPage + (direction === "rtl" ? -1 : 1));
      else if (e.key === "ArrowLeft") goTo(currentPage + (direction === "rtl" ? 1 : -1));
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [mode, currentPage, goTo, direction]);

  // ── Touch gestures (page mode): pinch-zoom + pan + tap-zones + swipe ──────
  function onTouchStart(e: React.TouchEvent) {
    if (mode !== "page") return;
    if (e.touches.length === 2) {
      pinch.current = { dist: touchDist(e.touches[0], e.touches[1]), base: scale };
      tStart.current = null;
      return;
    }
    const t = e.touches[0];
    tStart.current = { x: t.clientX, y: t.clientY, t: Date.now() };
    moved.current = false;
    if (scale > 1) panStart.current = { x: t.clientX, y: t.clientY, px: pan.x, py: pan.y };
  }

  function onTouchMove(e: React.TouchEvent) {
    if (mode !== "page") return;
    if (e.touches.length === 2 && pinch.current) {
      const s = clampN((pinch.current.base * touchDist(e.touches[0], e.touches[1])) / pinch.current.dist, 1, 3);
      setScale(s);
      moved.current = true;
      return;
    }
    if (e.touches.length === 1 && scale > 1 && panStart.current) {
      const t = e.touches[0];
      const elW = zoomElRef.current?.offsetWidth ?? window.innerWidth;
      const elH = zoomElRef.current?.offsetHeight ?? window.innerHeight;
      const bx = (elW * (scale - 1)) / 2;
      const by = (elH * (scale - 1)) / 2;
      setPan({
        x: clampN(panStart.current.px + (t.clientX - panStart.current.x), -bx, bx),
        y: clampN(panStart.current.py + (t.clientY - panStart.current.y), -by, by),
      });
      moved.current = true;
      return;
    }
    if (e.touches.length === 1 && tStart.current) {
      const t = e.touches[0];
      if (Math.abs(t.clientX - tStart.current.x) > 10 || Math.abs(t.clientY - tStart.current.y) > 10)
        moved.current = true;
    }
  }

  function onTouchEnd(e: React.TouchEvent) {
    if (mode !== "page") return;
    // A pinch just ended — snap back to 1x if barely zoomed.
    if (pinch.current) {
      pinch.current = null;
      if (scale < 1.05) {
        setScale(1);
        setPan({ x: 0, y: 0 });
      }
      return;
    }
    const st = tStart.current;
    tStart.current = null;
    if (!st) return;
    const ct = e.changedTouches[0];
    const dx = ct.clientX - st.x;
    const dy = ct.clientY - st.y;
    const dt = Date.now() - st.t;

    // While zoomed: a drag pans (already applied); a double-tap resets zoom.
    if (scale > 1) {
      if (!moved.current) {
        const now = Date.now();
        if (now - lastTap.current < 300) {
          setScale(1);
          setPan({ x: 0, y: 0 });
          lastTap.current = 0;
        } else {
          lastTap.current = now;
        }
      }
      return;
    }

    // Tap (no significant move) → left/right third navigates (center reserved).
    if (!moved.current && dt < 500) {
      const w = window.innerWidth;
      if (ct.clientX < w / 3) flip(direction === "rtl" ? 1 : -1);
      else if (ct.clientX > (2 * w) / 3) flip(direction === "rtl" ? -1 : 1);
      return;
    }
    // Horizontal swipe → flip (mirrored for RTL).
    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 50) {
      const dir = dx < 0 ? 1 : -1; // physical swipe-left = forward in LTR
      flip(direction === "rtl" ? -dir : dir);
    }
  }

  const progress = pages.length > 0 ? ((currentPage + 1) / pages.length) * 100 : 0;
  const showChapterMenu = !onBack && !!chapters && chapters.length > 0;
  const leftAction = direction === "rtl" ? 1 : -1;
  const rightAction = direction === "rtl" ? -1 : 1;
  const pageLabel = (
    <>
      ตอนที่ {chapterNum}
      {mode === "page" && ` — ${currentPage + 1}/${pages.length}`}
    </>
  );

  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      {/* Top bar */}
      <div className="sticky top-0 z-40 bg-[var(--bg-primary)]/95 backdrop-blur border-b border-[var(--border)]">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
          {onBack ? (
            <button
              onClick={onBack}
              className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors text-sm flex items-center gap-1"
            >
              <ChevronLeft className="w-4 h-4" />
              คลัง
            </button>
          ) : (
            <Link
              href={`/content/${mangaSlug}`}
              className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors text-sm flex items-center gap-1"
            >
              <ChevronLeft className="w-4 h-4" />
              กลับ
            </Link>
          )}

          {/* Chapter label — a jump-to-chapter dropdown when a list is provided. */}
          <div className="flex items-center gap-2">
            {showChapterMenu ? (
              <div className="relative">
                <button
                  onClick={() => setShowChapters((v) => !v)}
                  aria-label="เลือกตอน"
                  className="text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors flex items-center gap-1"
                >
                  {pageLabel}
                  <ChevronDown className="w-3.5 h-3.5 shrink-0" />
                </button>
                {showChapters && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowChapters(false)} />
                    <div className="absolute left-1/2 -translate-x-1/2 top-9 z-50 w-60 max-h-80 overflow-y-auto bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl py-1 shadow-xl">
                      {chapters!.map((c) => (
                        <button
                          key={c.num}
                          onClick={() => {
                            setShowChapters(false);
                            router.push(`/content/${mangaSlug}/${c.num}`);
                          }}
                          className={clsx(
                            "w-full text-left px-3 py-2 text-xs transition-colors hover:bg-white/10",
                            c.num === chapterNum
                              ? "text-[var(--text-primary)] font-semibold bg-white/5"
                              : "text-[var(--text-secondary)]"
                          )}
                        >
                          ตอน {c.num}
                          {c.title ? ` · ${c.title}` : ""}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            ) : (
              <span className="text-sm text-[var(--text-secondary)]">{pageLabel}</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* Quick "next chapter" jump on the top bar too (bottom bar already has
                one) — saves scrolling to the end of long chapters to advance.
                Hidden in the offline reader (onBack), which has no /content route. */}
            {!onBack && nextChapter != null && (
              <Link
                href={`/content/${mangaSlug}/${nextChapter}`}
                aria-label="ตอนถัดไป"
                title="ตอนถัดไป"
                className="flex items-center gap-1 pl-2.5 pr-2 py-1.5 rounded-lg bg-[var(--accent)] text-xs text-[var(--text-primary)] hover:opacity-90 transition-all"
              >
                <span className="hidden sm:inline">ตอนถัดไป</span>
                <ChevronRight className="w-4 h-4 shrink-0" />
              </Link>
            )}
            {chapterId && (
              <DownloadChapterButton
                kind="manga"
                chapterId={chapterId}
                mangaSlug={mangaSlug}
                chapterNum={chapterNum}
                mangaTitle={mangaTitle || mangaSlug}
                coverUrl={coverUrl}
                pages={pages.map((p) => ({ src: p.src, width: p.width, height: p.height }))}
              />
            )}
            <button
              onClick={() => setMode(mode === "webtoon" ? "page" : "webtoon")}
              aria-label={mode === "webtoon" ? "เปลี่ยนเป็นโหมดหน้า" : "เปลี่ยนเป็นโหมด Webtoon"}
              className="p-2 rounded-lg hover:bg-white/10 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
              title={mode === "webtoon" ? "เปลี่ยนเป็นโหมดหน้า" : "เปลี่ยนเป็นโหมด Webtoon"}
            >
              {mode === "webtoon" ? (
                <BookOpen className="w-4 h-4" />
              ) : (
                <AlignJustify className="w-4 h-4" />
              )}
            </button>
            <button
              onClick={() => setShowSettings(!showSettings)}
              aria-label="ตั้งค่าการอ่าน"
              className="p-2 rounded-lg hover:bg-white/10 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
            >
              <Settings className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Progress bar */}
        {mode === "page" && (
          <div className="h-0.5 bg-white/10">
            <div
              className="h-full bg-[var(--accent)] transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        )}
      </div>

      {/* Settings panel */}
      {showSettings && (
        <div className="fixed top-16 right-2 sm:right-4 z-50 bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl p-4 w-64 max-w-[calc(100vw-1rem)] ">
          <h4 className="text-sm font-semibold text-[var(--text-primary)] mb-3">ตั้งค่าการอ่าน</h4>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-[var(--text-secondary)] block mb-1">
                ความสว่าง: {brightness}%
              </label>
              <input
                type="range"
                min={50}
                max={150}
                value={brightness}
                onChange={(e) => setBrightness(Number(e.target.value))}
                className="w-full accent-[var(--text-primary)]"
              />
            </div>
            <div>
              <label className="text-xs text-[var(--text-secondary)] block mb-1">โหมดการอ่าน</label>
              <div className="flex gap-2">
                {(["webtoon", "page"] as const).map((m) => (
                  <button
                    key={m}
                    onClick={() => setMode(m)}
                    className={clsx(
                      "flex-1 py-1.5 rounded-lg text-xs font-medium transition-all",
                      mode === m
                        ? "bal-btn"
                        : "bg-white/10 text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                    )}
                  >
                    {m === "webtoon" ? "เลื่อน" : "หน้า"}
                  </button>
                ))}
              </div>
            </div>
            {/* Reading direction — only affects the paged (หน้า) mode. */}
            <div>
              <label className="text-xs text-[var(--text-secondary)] block mb-1">ทิศทางอ่าน (โหมดหน้า)</label>
              <div className="flex gap-2">
                {([
                  { v: "ltr", label: "ซ้าย→ขวา" },
                  { v: "rtl", label: "ขวา→ซ้าย" },
                ] as const).map((d) => (
                  <button
                    key={d.v}
                    onClick={() => changeDir(d.v)}
                    className={clsx(
                      "flex-1 py-1.5 rounded-lg text-xs font-medium transition-all",
                      direction === d.v
                        ? "bal-btn"
                        : "bg-white/10 text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                    )}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Content */}
      <div
        style={{ filter: `brightness(${brightness}%)` }}
        className="max-w-4xl mx-auto select-none"
        onContextMenu={(e) => e.preventDefault()}
      >
        {mode === "webtoon" ? (
          <div className="flex flex-col items-center">
            {pages.map((page, i) => (
              <MangaCanvas
                key={page.pageNum}
                source={page.src}
                alt={`Page ${page.pageNum}`}
                w={page.width || 800}
                h={page.height || 1200}
                full
                // Paint the first screenful immediately so the chapter opens
                // without a skeleton flash at the top.
                priority={i < 2}
                registerRef={(el) => {
                  pageEls.current[i] = el;
                }}
              />
            ))}
          </div>
        ) : (
          <div
            className="relative min-h-screen flex items-center justify-center p-4 overflow-hidden"
            style={{ touchAction: "none" }}
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEnd}
          >
            {/* Render a small window around the current page and keep neighbours
                mounted+decoded (priority) so flipping is instant. Only the
                current one is shown; the rest are decoded off-screen. */}
            {[currentPage - 1, currentPage, currentPage + 1, currentPage + 2]
              .filter((i) => i >= 0 && i < pages.length)
              .map((i) => (
                <div
                  key={pages[i].pageNum}
                  className={i === currentPage ? "w-full flex items-center justify-center" : "hidden"}
                >
                  {i === currentPage ? (
                    <div
                      ref={zoomElRef}
                      className="w-full flex items-center justify-center"
                      style={{
                        transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`,
                        transformOrigin: "center center",
                        transition: scale === 1 ? "transform 0.18s ease-out" : "none",
                      }}
                    >
                      <MangaCanvas
                        source={pages[i].src}
                        alt={`Page ${i + 1}`}
                        w={pages[i].width || 800}
                        h={pages[i].height || 1200}
                        full={false}
                        priority
                      />
                    </div>
                  ) : (
                    <MangaCanvas
                      source={pages[i].src}
                      alt={`Page ${i + 1}`}
                      w={pages[i].width || 800}
                      h={pages[i].height || 1200}
                      full={false}
                      priority
                    />
                  )}
                </div>
              ))}

            {/* Nav buttons — actions/disabled mirror the reading direction (in RTL
                the left chevron advances, since "next" sits to the left). */}
            <button
              onClick={() => goTo(currentPage + leftAction)}
              disabled={currentPage + leftAction < 0 || currentPage + leftAction >= pages.length}
              aria-label={direction === "rtl" ? "หน้าถัดไป" : "หน้าก่อนหน้า"}
              className="absolute left-2 top-1/2 -translate-y-1/2 p-3 rounded-full bg-black/60 text-[var(--text-primary)] disabled:opacity-20 hover:bg-black/80 transition-all"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
            <button
              onClick={() => goTo(currentPage + rightAction)}
              disabled={currentPage + rightAction < 0 || currentPage + rightAction >= pages.length}
              aria-label={direction === "rtl" ? "หน้าก่อนหน้า" : "หน้าถัดไป"}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-3 rounded-full bg-black/60 text-[var(--text-primary)] disabled:opacity-20 hover:bg-black/80 transition-all"
            >
              <ChevronRight className="w-6 h-6" />
            </button>
          </div>
        )}
      </div>

      {/* Chapter navigation */}
      <div className="sticky bottom-0 bg-[var(--bg-primary)]/95 backdrop-blur border-t border-[var(--border)] p-3 sm:p-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-2 sm:gap-4">
          {prevChapter != null ? (
            <Link
              href={`/content/${mangaSlug}/${prevChapter}`}
              className="flex items-center gap-1.5 px-3 py-2.5 sm:px-4 rounded-xl bg-[var(--bg-card)] border border-[var(--border)] text-sm text-[var(--text-primary)] hover:text-[var(--text-primary)] hover:border-white/30 transition-all"
            >
              <ChevronLeft className="w-4 h-4 shrink-0" />
              <span className="hidden sm:inline">ตอนก่อน</span>
            </Link>
          ) : (
            <div className="w-10" />
          )}

          <span className="text-xs sm:text-sm text-[var(--text-secondary)] text-center">
            {mode === "page"
              ? `${currentPage + 1} / ${pages.length} หน้า`
              : `${pages.length} หน้า`}
          </span>

          {nextChapter != null ? (
            <Link
              href={`/content/${mangaSlug}/${nextChapter}`}
              className="flex items-center gap-1.5 px-3 py-2.5 sm:px-4 rounded-xl bg-[var(--accent)] text-sm text-[var(--text-primary)] hover:opacity-90 transition-all"
            >
              <span className="hidden sm:inline">ตอนถัดไป</span>
              <ChevronRight className="w-4 h-4 shrink-0" />
            </Link>
          ) : (
            <div className="w-10" />
          )}
        </div>
      </div>
    </div>
  );
}
