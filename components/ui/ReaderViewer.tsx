"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { ChevronLeft, ChevronRight, Settings, AlignJustify, BookOpen } from "lucide-react";
import clsx from "clsx";
import Link from "next/link";
import { isLikelyAutomated } from "@/lib/botCheck";

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
}

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
}: {
  source: string;
  alt: string;
  w: number;
  h: number;
  full: boolean;
  priority?: boolean;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
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
      { rootMargin: "1200px 0px" }
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
      ref={wrapRef}
      className={full ? "relative w-full" : "relative"}
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
}: ReaderViewerProps) {
  const [mode, setMode] = useState<"webtoon" | "page">("webtoon");
  const [currentPage, setCurrentPage] = useState(0);
  const [brightness, setBrightness] = useState(100);
  const [showSettings, setShowSettings] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);

  const goTo = useCallback(
    (idx: number) => {
      const clamped = Math.max(0, Math.min(pages.length - 1, idx));
      setCurrentPage(clamped);
      onPageChange?.(clamped + 1);
    },
    [pages.length, onPageChange]
  );

  useEffect(() => {
    if (mode !== "page") return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === "ArrowDown") goTo(currentPage + 1);
      if (e.key === "ArrowLeft" || e.key === "ArrowUp") goTo(currentPage - 1);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [mode, currentPage, goTo]);

  function handleTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  }

  function handleTouchEnd(e: React.TouchEvent) {
    if (mode !== "page" || touchStartX.current === null || touchStartY.current === null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    const dy = e.changedTouches[0].clientY - touchStartY.current;
    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 50) {
      if (dx < 0) goTo(currentPage + 1);
      else goTo(currentPage - 1);
    }
    touchStartX.current = null;
    touchStartY.current = null;
  }

  const progress = pages.length > 0 ? ((currentPage + 1) / pages.length) * 100 : 0;

  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      {/* Top bar */}
      <div className="sticky top-0 z-40 bg-[var(--bg-primary)]/95 backdrop-blur border-b border-[var(--border)]">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link
            href={`/content/${mangaSlug}`}
            className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors text-sm flex items-center gap-1"
          >
            <ChevronLeft className="w-4 h-4" />
            กลับ
          </Link>

          <div className="flex items-center gap-2">
            <span className="text-sm text-[var(--text-secondary)]">
              ตอนที่ {chapterNum}
              {mode === "page" && ` — ${currentPage + 1}/${pages.length}`}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setMode(mode === "webtoon" ? "page" : "webtoon")}
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
          </div>
        </div>
      )}

      {/* Content */}
      <div
        ref={containerRef}
        style={{ filter: `brightness(${brightness}%)` }}
        className="max-w-4xl mx-auto select-none"
        onContextMenu={(e) => e.preventDefault()}
      >
        {mode === "webtoon" ? (
          <div className="flex flex-col items-center">
            {pages.map((page) => (
              <MangaCanvas
                key={page.pageNum}
                source={page.src}
                alt={`Page ${page.pageNum}`}
                w={page.width || 800}
                h={page.height || 1200}
                full
              />
            ))}
          </div>
        ) : (
          <div
            className="relative min-h-screen flex items-center justify-center p-4"
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
          >
            {pages[currentPage] && (
              <MangaCanvas
                source={pages[currentPage].src}
                alt={`Page ${currentPage + 1}`}
                w={pages[currentPage].width || 800}
                h={pages[currentPage].height || 1200}
                full={false}
                priority
              />
            )}

            {/* Nav buttons */}
            <button
              onClick={() => goTo(currentPage - 1)}
              disabled={currentPage === 0}
              className="absolute left-2 top-1/2 -translate-y-1/2 p-3 rounded-full bg-black/60 text-[var(--text-primary)] disabled:opacity-20 hover:bg-black/80 transition-all"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
            <button
              onClick={() => goTo(currentPage + 1)}
              disabled={currentPage === pages.length - 1}
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
