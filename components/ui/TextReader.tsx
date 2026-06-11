"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Settings, X, BookOpen } from "lucide-react";

interface Props {
  html: string;
  chapterTitle?: string | null;
  chapterNum: number;
  mangaTitle: string;
  mangaSlug: string;
  prevChapter?: number | null;
  nextChapter?: number | null;
  minutes?: number;
  authorNote?: string | null;
}

type Settings = {
  size: number; // px
  leading: number;
  serif: boolean;
  width: "narrow" | "normal" | "wide";
  theme: "default" | "sepia" | "light" | "dark";
};

const DEFAULT: Settings = { size: 20, leading: 1.9, serif: true, width: "normal", theme: "default" };
const LS_KEY = "novelReaderSettings";

const THEMES: Record<Settings["theme"], { bg: string; fg: string; label: string }> = {
  default: { bg: "var(--bg-primary)", fg: "var(--text-primary)", label: "ตามธีม" },
  sepia: { bg: "#f4ecd8", fg: "#4a3f30", label: "ซีเปีย" },
  light: { bg: "#ffffff", fg: "#1a1a1a", label: "สว่าง" },
  dark: { bg: "#0a0a0a", fg: "#d6d6d6", label: "มืด" },
};
const WIDTHS = { narrow: "max-w-xl", normal: "max-w-2xl", wide: "max-w-3xl" };

export default function TextReader({
  html, chapterTitle, chapterNum, mangaTitle, mangaSlug, prevChapter, nextChapter, minutes, authorNote,
}: Props) {
  const [s, setS] = useState<Settings>(DEFAULT);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(LS_KEY);
      if (saved) setS({ ...DEFAULT, ...JSON.parse(saved) });
    } catch { /* ignore */ }
  }, []);

  function update(patch: Partial<Settings>) {
    setS((prev) => {
      const next = { ...prev, ...patch };
      try { localStorage.setItem(LS_KEY, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  }

  const t = THEMES[s.theme];

  return (
    <div style={{ background: t.bg, color: t.fg }} className="min-h-screen transition-colors">
      {/* top bar */}
      <div className="sticky top-0 z-30 backdrop-blur-sm border-b border-black/10" style={{ background: t.bg }}>
        <div className={`mx-auto ${WIDTHS[s.width]} px-4 py-3 flex items-center justify-between gap-3`}>
          <Link href={`/content/${mangaSlug}`} className="text-sm truncate hover:opacity-70 transition-opacity" style={{ color: t.fg }}>
            ← {mangaTitle}
          </Link>
          <button onClick={() => setOpen((o) => !o)} aria-label="ตั้งค่าการอ่าน" className="shrink-0 p-1.5 hover:opacity-70">
            <Settings className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* settings panel */}
      {open && (
        <div className="sticky top-[53px] z-30 border-b border-black/10" style={{ background: t.bg }}>
          <div className={`mx-auto ${WIDTHS[s.width]} px-4 py-3 space-y-3 text-sm`}>
            <div className="flex items-center justify-between">
              <span className="opacity-60 uppercase tracking-wide text-xs">ขนาดอักษร</span>
              <div className="flex items-center gap-2">
                <button onClick={() => update({ size: Math.max(15, s.size - 1) })} className="w-8 h-8 border border-current/30 flex items-center justify-center">A−</button>
                <span className="w-9 text-center">{s.size}</span>
                <button onClick={() => update({ size: Math.min(30, s.size + 1) })} className="w-8 h-8 border border-current/30 flex items-center justify-center">A+</button>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="opacity-60 uppercase tracking-wide text-xs">ระยะบรรทัด</span>
              <div className="flex gap-1.5">
                {[1.6, 1.9, 2.2].map((lh) => (
                  <button key={lh} onClick={() => update({ leading: lh })} className={`px-3 h-8 border ${s.leading === lh ? "bg-current text-[var(--bg-primary)] border-current" : "border-current/30"}`} style={s.leading === lh ? { color: t.bg } : undefined}>{lh}</button>
                ))}
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="opacity-60 uppercase tracking-wide text-xs">ฟอนต์</span>
              <div className="flex gap-1.5">
                {[{ k: true, l: "Serif" }, { k: false, l: "Sans" }].map((f) => (
                  <button key={f.l} onClick={() => update({ serif: f.k })} className={`px-3 h-8 border ${s.serif === f.k ? "bg-current border-current" : "border-current/30"}`} style={s.serif === f.k ? { color: t.bg } : undefined}>{f.l}</button>
                ))}
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="opacity-60 uppercase tracking-wide text-xs">ความกว้าง</span>
              <div className="flex gap-1.5">
                {(["narrow", "normal", "wide"] as const).map((w) => (
                  <button key={w} onClick={() => update({ width: w })} className={`px-3 h-8 border ${s.width === w ? "bg-current border-current" : "border-current/30"}`} style={s.width === w ? { color: t.bg } : undefined}>{w === "narrow" ? "แคบ" : w === "normal" ? "กลาง" : "กว้าง"}</button>
                ))}
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="opacity-60 uppercase tracking-wide text-xs">พื้นหลัง</span>
              <div className="flex gap-1.5">
                {(Object.keys(THEMES) as Settings["theme"][]).map((th) => (
                  <button key={th} onClick={() => update({ theme: th })} className={`px-2.5 h-8 border text-xs ${s.theme === th ? "ring-2 ring-current" : "border-current/30"}`} style={{ background: THEMES[th].bg, color: THEMES[th].fg }}>{THEMES[th].label}</button>
                ))}
              </div>
            </div>
            <button onClick={() => setOpen(false)} className="w-full py-1.5 flex items-center justify-center gap-1 opacity-60 hover:opacity-100"><X className="w-4 h-4" /> ปิด</button>
          </div>
        </div>
      )}

      {/* content */}
      <article className={`mx-auto ${WIDTHS[s.width]} px-5 sm:px-6 py-10`}>
        <p className="text-xs uppercase tracking-[0.3em] opacity-50 mb-2 flex items-center gap-2">
          <BookOpen className="w-3.5 h-3.5" /> ตอนที่ {chapterNum}{minutes ? ` · อ่าน ~${minutes} นาที` : ""}
        </p>
        {chapterTitle && <h1 className="font-bebas text-3xl sm:text-4xl tracking-wide mb-8">{chapterTitle}</h1>}
        <div
          style={{ fontSize: `${s.size}px`, lineHeight: s.leading, fontFamily: s.serif ? "Georgia, 'Times New Roman', serif" : "var(--font-noto), sans-serif" }}
          className="novel-body [&_p]:mb-5 [&_h2]:text-2xl [&_h2]:font-semibold [&_h2]:mt-8 [&_h2]:mb-3 [&_h3]:text-xl [&_h3]:font-semibold [&_h3]:mt-6 [&_h3]:mb-2 [&_blockquote]:border-l-2 [&_blockquote]:border-current/40 [&_blockquote]:pl-4 [&_blockquote]:opacity-80 [&_blockquote]:italic [&_hr]:my-8 [&_hr]:border-current/20 [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:mb-5 [&_ol]:list-decimal [&_ol]:pl-6 [&_ol]:mb-5 [&_a]:underline [&_a]:opacity-90 [&_img]:max-w-full [&_img]:h-auto [&_img]:my-4 [&_img]:mx-auto"
          dangerouslySetInnerHTML={{ __html: html }}
        />

        {authorNote && (
          <div className="mt-10 border-t border-current/15 pt-5">
            <p className="text-[11px] uppercase tracking-[0.25em] opacity-50 mb-2">โน้ตผู้เขียน</p>
            <p className="text-sm opacity-80 whitespace-pre-line leading-relaxed">{authorNote}</p>
          </div>
        )}
      </article>

      {/* prev / next */}
      <div className={`mx-auto ${WIDTHS[s.width]} px-5 sm:px-6 pb-16 flex items-center justify-between gap-3`}>
        {prevChapter != null ? (
          <Link href={`/content/${mangaSlug}/${prevChapter}`} className="flex items-center gap-1 px-4 py-2.5 border border-current/30 hover:bg-current/10 text-sm">
            <ChevronLeft className="w-4 h-4" /> ตอนก่อน
          </Link>
        ) : <span />}
        {nextChapter != null ? (
          <Link href={`/content/${mangaSlug}/${nextChapter}`} className="flex items-center gap-1 px-4 py-2.5 border border-current/30 hover:bg-current/10 text-sm ml-auto">
            ตอนถัดไป <ChevronRight className="w-4 h-4" />
          </Link>
        ) : <span />}
      </div>
    </div>
  );
}
