"use client";

import Link from "next/link";
import Image from "next/image";
import clsx from "clsx";
import { Star, Eye, Bookmark } from "lucide-react";
import { useReadingProgress } from "./ReadingProgressProvider";

interface MangaCardProps {
  slug: string;
  title: string;
  coverUrl?: string | null;
  latestChapter?: number;
  rating?: number;
  views?: number;
  status?: string;
  type?: string;
  contentRating?: string;
  className?: string;
  variant?: "default" | "compact" | "large";
}

export default function MangaCard({
  slug,
  title,
  coverUrl,
  latestChapter,
  rating,
  views,
  status,
  type,
  contentRating,
  className,
  variant = "default",
}: MangaCardProps) {
  const isCompact = variant === "compact";
  const isLarge = variant === "large";

  const { bySlug } = useReadingProgress();
  const readPercent = bySlug[slug];
  const hasProgress = readPercent !== undefined && readPercent > 0;

  return (
    <Link
      href={`/content/${slug}`}
      className={clsx(
        "group relative flex flex-col rounded-xl overflow-hidden bal-invert",
        "bg-[var(--bg-card)] border border-[var(--border)]",
        "transition-all duration-300 hover:-translate-y-1 hover:",
        isLarge ? "h-80" : isCompact ? "h-36 flex-row" : "h-auto",
        className
      )}
    >
      {/* Cover */}
      <div
        className={clsx(
          "relative overflow-hidden bg-[var(--bg-surface)] flex-shrink-0",
          isLarge ? "h-full w-full absolute inset-0" : isCompact ? "w-24 h-full" : "aspect-[3/4] w-full"
        )}
      >
        {coverUrl ? (
          <Image
            src={coverUrl}
            alt={title}
            fill
            unoptimized
            className={clsx(
              "object-cover transition-transform duration-500 group-hover:scale-105",
              isLarge && "opacity-60"
            )}
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-[var(--bg-card)] to-[var(--bg-surface)]">
            <span className="text-4xl opacity-20">📖</span>
          </div>
        )}

        {/* Status badge */}
        {status && (
          <span
            className={clsx(
              "absolute top-2 left-2 text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider",
              status === "ONGOING"
                ? "bg-[var(--bg-card)] text-[var(--text-primary)]"
                : status === "COMPLETED"
                ? "bg-[var(--bg-card)] text-[var(--text-primary)]"
                : "bg-[var(--bg-card)] text-black"
            )}
          >
            {status}
          </span>
        )}

        {/* Type badge — novels clearly flagged so readers don't mistake them for comics */}
        {contentRating !== "ADULT" && type === "NOVEL" && (
          <span className="absolute top-2 right-2 text-[10px] font-black px-2 py-0.5 rounded uppercase tracking-wider bg-[var(--text-primary)] text-[var(--bg-primary)]">
            นิยาย
          </span>
        )}
        {contentRating !== "ADULT" && type && type !== "NOVEL" && !isCompact && (
          <span className="absolute top-2 right-2 text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider bg-[var(--bg-card)]/90 text-[var(--text-primary)] border border-[var(--border)]">
            {type === "MANGA" ? "มังงะ" : type === "MANHWA" ? "มังฮวา" : type === "MANHUA" ? "มังฮัว" : type}
          </span>
        )}

        {/* 18+ badge */}
        {contentRating === "ADULT" && (
          <span className="absolute top-2 right-2 text-[10px] font-black px-1.5 py-0.5 rounded bg-[var(--text-primary)] text-[var(--bg-primary)] border border-[var(--border)]">
            18+
          </span>
        )}

        {/* Reading progress (per-user, from context) */}
        {hasProgress && (
          <>
            {!isCompact && (
              <span className="absolute bottom-1.5 left-1.5 z-10 text-[9px] font-bold px-1.5 py-0.5 rounded bg-[var(--text-primary)] text-[var(--bg-primary)]">
                {readPercent >= 100 ? "อ่านจบแล้ว" : `อ่านแล้ว ${readPercent}%`}
              </span>
            )}
            <div className="absolute bottom-0 inset-x-0 h-1 bg-black/40 z-10">
              <div
                className="h-full bg-[var(--text-primary)]"
                style={{ width: `${readPercent}%` }}
              />
            </div>
          </>
        )}
      </div>

      {/* Info */}
      <div
        className={clsx(
          "flex flex-col gap-1 z-10",
          isLarge
            ? "absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/90 to-transparent"
            : isCompact
            ? "p-2 justify-center flex-1 min-w-0"
            : "p-3"
        )}
      >
        <h3
          className={clsx(
            "font-semibold text-[var(--text-primary)] leading-tight line-clamp-2",
            isCompact ? "text-sm" : "text-sm",
            isLarge && "text-base"
          )}
        >
          {title}
        </h3>

        <div className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
          {latestChapter !== undefined && (
            <span className="text-[var(--text-primary)] font-medium">
              Ch.{latestChapter}
            </span>
          )}
          {rating !== undefined && (
            <span className="flex items-center gap-0.5">
              <Star className="w-3 h-3 fill-[var(--text-primary)] text-[var(--text-primary)]" />
              {rating.toFixed(1)}
            </span>
          )}
          {views !== undefined && !isCompact && (
            <span className="flex items-center gap-0.5">
              <Eye className="w-3 h-3" />
              {views >= 1000 ? `${(views / 1000).toFixed(1)}k` : views}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
