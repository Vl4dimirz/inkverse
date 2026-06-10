import Link from "next/link";
import Image from "next/image";
import { Star, Eye, BookOpen, Play } from "lucide-react";

interface HeroBannerProps {
  title: string;
  description: string;
  coverUrl?: string | null;
  slug: string;
  genres?: string[];
  rating?: number;
  latestChapter?: number;
}

export default function HeroBanner({
  title,
  description,
  coverUrl,
  slug,
  genres = [],
  rating,
  latestChapter,
}: HeroBannerProps) {
  return (
    <section className="relative mb-10 rounded-3xl overflow-hidden h-72 sm:h-96 lg:h-[480px] border border-[var(--border)]">
      {/* Background */}
      {coverUrl ? (
        <Image
          src={coverUrl}
          alt={title}
          fill
          unoptimized
          className="object-cover opacity-40"
          priority
          sizes="100vw"
        />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-[var(--accent)]/20 via-[var(--bg-card)] to-[var(--accent)]/10" />
      )}

      {/* Animated gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-r from-[var(--bg-primary)] via-[var(--bg-primary)]/80 to-transparent" />
      <div className="absolute inset-0 bg-gradient-to-t from-[var(--bg-primary)] via-transparent to-transparent" />

      {/* Animated accent blobs */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-[var(--text-primary)]/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3" />
      <div className="absolute bottom-0 left-1/3 w-64 h-64 bg-[var(--text-primary)]/10 rounded-full blur-3xl translate-y-1/2" />

      {/* Content */}
      <div className="relative h-full flex items-end pb-8 px-6 sm:px-10 lg:px-14 max-w-3xl">
        <div>
          {/* Genres */}
          <div className="flex flex-wrap gap-1.5 mb-3">
            {genres.slice(0, 4).map((g) => (
              <span
                key={g}
                className="text-xs px-2 py-0.5 rounded-full bg-[var(--text-primary)]/80 text-[var(--text-primary)] font-medium"
              >
                {g}
              </span>
            ))}
          </div>

          {/* Title */}
          <h1 className="font-bebas text-4xl sm:text-5xl lg:text-6xl text-[var(--text-primary)] tracking-wider leading-none mb-2">
            {title}
          </h1>

          {/* Description */}
          <p className="text-sm sm:text-base text-[var(--text-primary)] line-clamp-2 mb-4 max-w-lg">
            {description}
          </p>

          {/* Stats */}
          <div className="flex items-center gap-4 mb-5 text-sm text-[var(--text-secondary)]">
            {rating !== undefined && rating > 0 && (
              <span className="flex items-center gap-1">
                <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                {rating.toFixed(1)}
              </span>
            )}
            {latestChapter !== undefined && (
              <span className="flex items-center gap-1">
                <BookOpen className="w-4 h-4 text-[var(--text-primary)]" />
                {latestChapter} ตอน
              </span>
            )}
          </div>

          {/* CTA buttons */}
          <div className="flex items-center gap-3">
            <Link
              href={`/content/${slug}`}
              className="flex items-center gap-2 px-6 py-3 rounded-xl bg-[var(--text-primary)] text-[var(--bg-primary)] font-semibold text-sm hover:opacity-90 transition-opacity shadow-lg shadow-[var(--text-primary)]/25"
            >
              <Play className="w-4 h-4 fill-white" />
              อ่านเลย
            </Link>
            <Link
              href={`/content/${slug}`}
              className="flex items-center gap-2 px-6 py-3 rounded-xl bg-white/10 backdrop-blur text-[var(--text-primary)] font-semibold text-sm hover:bg-white/20 transition-all border border-[var(--border)]"
            >
              รายละเอียด
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
