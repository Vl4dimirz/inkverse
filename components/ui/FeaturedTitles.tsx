"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { ArrowRight, ChevronLeft, ChevronRight, Star, Eye, BookOpen } from "lucide-react";

export type FeaturedItem = {
  slug: string;
  title: string;
  coverUrl?: string | null;
  description?: string | null;
  genres?: string[];
  type?: string;
  rating?: number;
  views?: number;
  latestChapter?: number;
};

const INTERVAL = 5500;

// Editorial "เรื่องเด่น" banner — a rotating showcase of featured titles using
// their real cover art (ReadAWrite-style). Kept separate from ads on purpose:
// this is content discovery / free creator promotion, not a paid ad slot.
export default function FeaturedTitles({ items }: { items: FeaturedItem[] }) {
  const [i, setI] = useState(0);
  const paused = useRef(false);

  useEffect(() => {
    if (items.length <= 1) return;
    const id = setInterval(() => {
      if (!paused.current) setI((p) => (p + 1) % items.length);
    }, INTERVAL);
    return () => clearInterval(id);
  }, [items.length]);

  if (items.length === 0) return null;
  const go = (n: number) => setI((n + items.length) % items.length);

  return (
    <section className="mb-12">
      <h2 className="font-bebas text-2xl text-[var(--text-primary)] tracking-[0.18em] uppercase flex items-center gap-3 mb-4">
        <span className="w-6 h-px bg-[var(--text-primary)]" />
        เรื่องเด่น
      </h2>

      <div
        className="relative overflow-hidden h-80 lg:h-[380px] border border-[var(--border)] bg-[var(--bg-surface)]"
        onMouseEnter={() => (paused.current = true)}
        onMouseLeave={() => (paused.current = false)}
      >
        {items.map((it, idx) => (
          <div
            key={it.slug}
            className={`absolute inset-0 transition-opacity duration-700 ${
              idx === i ? "opacity-100" : "opacity-0 pointer-events-none"
            }`}
          >
            {/* ambient blurred cover backdrop */}
            {it.coverUrl && (
              <Image
                src={it.coverUrl}
                alt=""
                fill
                unoptimized
                loading={idx === 0 ? "eager" : "lazy"}
                className="object-cover opacity-20 blur-2xl scale-110"
                sizes="100vw"
              />
            )}
            <div className="absolute inset-0 bg-gradient-to-r from-[var(--bg-primary)] via-[var(--bg-primary)]/85 to-transparent" />

            <div className="relative h-full flex items-center gap-4 sm:gap-6 px-5 sm:px-10 lg:px-14">
              {/* text */}
              <div className={`flex-1 min-w-0 max-w-lg ${idx === i ? "iv-rise" : ""}`}>
                <p className="eyebrow mb-3">
                  {it.type === "NOVEL" ? "นิยาย" : it.genres?.[0] ?? "แนะนำ"}
                </p>
                <h3 className="font-bebas text-3xl sm:text-4xl lg:text-5xl text-[var(--text-primary)] tracking-[0.04em] leading-[0.95] uppercase line-clamp-2 mb-3">
                  {it.title}
                </h3>
                {it.description && (
                  <p className="max-sm:hidden text-sm text-[var(--text-secondary)] line-clamp-2 mb-4 leading-relaxed">
                    {it.description}
                  </p>
                )}
                <div className="flex items-center gap-4 text-sm text-[var(--text-secondary)] mb-5">
                  {it.rating ? (
                    <span className="flex items-center gap-1">
                      <Star className="w-4 h-4 fill-[var(--text-primary)] text-[var(--text-primary)]" />
                      {it.rating.toFixed(1)}
                    </span>
                  ) : null}
                  {it.views !== undefined ? (
                    <span className="flex items-center gap-1">
                      <Eye className="w-4 h-4" />
                      {it.views >= 1000 ? `${(it.views / 1000).toFixed(1)}k` : it.views}
                    </span>
                  ) : null}
                  {it.latestChapter !== undefined ? (
                    <span className="flex items-center gap-1">
                      <BookOpen className="w-4 h-4" />
                      {it.latestChapter} ตอน
                    </span>
                  ) : null}
                </div>
                <Link
                  href={`/content/${it.slug}`}
                  className="inline-flex items-center gap-2 px-7 py-3 bal-btn font-semibold text-xs uppercase tracking-[0.2em] hover:opacity-90"
                >
                  อ่านเลย
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>

              {/* cover poster — visible on mobile too (smaller), so the cover always shows */}
              <Link
                href={`/content/${it.slug}`}
                className="block relative w-28 sm:w-36 md:w-44 lg:w-52 aspect-[3/4] flex-shrink-0 border border-[var(--border)] overflow-hidden group"
              >
                {it.coverUrl ? (
                  <Image
                    src={it.coverUrl}
                    alt={it.title}
                    fill
                    unoptimized
                    priority={idx === 0}
                    className="object-cover transition-transform duration-700 group-hover:scale-105"
                    sizes="220px"
                  />
                ) : (
                  <div className="w-full h-full bg-[var(--bg-card)]" />
                )}
              </Link>
            </div>
          </div>
        ))}

        {items.length > 1 && (
          <>
            {/* arrows */}
            <button
              aria-label="ก่อนหน้า"
              onClick={() => go(i - 1)}
              className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 hidden sm:flex items-center justify-center border border-[var(--border)] bg-[var(--bg-primary)]/60 text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--text-primary)]/50 transition-colors z-10"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              aria-label="ถัดไป"
              onClick={() => go(i + 1)}
              className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 hidden sm:flex items-center justify-center border border-[var(--border)] bg-[var(--bg-primary)]/60 text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--text-primary)]/50 transition-colors z-10"
            >
              <ChevronRight className="w-4 h-4" />
            </button>

            {/* dots */}
            <div className="absolute bottom-5 left-6 sm:left-10 lg:left-14 flex items-center gap-2 z-10">
              {items.map((_, idx) => (
                <button
                  key={idx}
                  aria-label={`สไลด์ ${idx + 1}`}
                  onClick={() => go(idx)}
                  className={`h-1 transition-all ${
                    idx === i ? "w-8 bg-[var(--text-primary)]" : "w-4 bg-[var(--text-primary)]/30 hover:bg-[var(--text-primary)]/60"
                  }`}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </section>
  );
}
