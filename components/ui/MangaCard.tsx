"use client";

import Link from "next/link";
import Image from "next/image";
import clsx from "clsx";
import { Star, Eye, Bookmark } from "lucide-react";

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

  return (
    <Link
      href={`/content/${slug}`}
      className={clsx(
        "group relative flex flex-col rounded-xl overflow-hidden",
        "bg-[#1a1e2a] border border-white/5",
        "transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl hover:shadow-[#ff2d55]/10 hover:border-[#ff2d55]/30",
        isLarge ? "h-80" : isCompact ? "h-36 flex-row" : "h-auto",
        className
      )}
    >
      {/* Cover */}
      <div
        className={clsx(
          "relative overflow-hidden bg-[#141720] flex-shrink-0",
          isLarge ? "h-full w-full absolute inset-0" : isCompact ? "w-24 h-full" : "aspect-[3/4] w-full"
        )}
      >
        {coverUrl ? (
          <Image
            src={coverUrl}
            alt={title}
            fill
            className={clsx(
              "object-cover transition-transform duration-500 group-hover:scale-105",
              isLarge && "opacity-60"
            )}
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-[#1a1e2a] to-[#141720]">
            <span className="text-4xl opacity-20">📖</span>
          </div>
        )}

        {/* Status badge */}
        {status && (
          <span
            className={clsx(
              "absolute top-2 left-2 text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider",
              status === "ONGOING"
                ? "bg-green-500/90 text-white"
                : status === "COMPLETED"
                ? "bg-blue-500/90 text-white"
                : "bg-yellow-500/90 text-black"
            )}
          >
            {status}
          </span>
        )}

        {/* Type badge */}
        {type && !isCompact && contentRating !== "ADULT" && (
          <span className="absolute top-2 right-2 text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider bg-[#ff2d55]/90 text-white">
            {type}
          </span>
        )}

        {/* 18+ badge */}
        {contentRating === "ADULT" && (
          <span className="absolute top-2 right-2 text-[10px] font-black px-1.5 py-0.5 rounded bg-red-600 text-white border border-red-400/50 shadow-lg">
            18+
          </span>
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
            "font-semibold text-white leading-tight line-clamp-2",
            isCompact ? "text-sm" : "text-sm",
            isLarge && "text-base"
          )}
        >
          {title}
        </h3>

        <div className="flex items-center gap-2 text-xs text-gray-400">
          {latestChapter !== undefined && (
            <span className="text-[#ff6b2b] font-medium">
              Ch.{latestChapter}
            </span>
          )}
          {rating !== undefined && (
            <span className="flex items-center gap-0.5">
              <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
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
