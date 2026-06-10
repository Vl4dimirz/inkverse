import Link from "next/link";
import Image from "next/image";
import { Star, Eye, BookOpen } from "lucide-react";
import clsx from "clsx";

interface SpotlightManga {
  slug: string;
  title: string;
  description: string;
  coverUrl?: string | null;
  rating?: number;
  totalViews?: number;
  latestChapter?: number;
  genres?: string[];
  type?: string;
}

interface FeaturedSpotlightProps {
  featured: SpotlightManga;
  secondary?: SpotlightManga[];
}

export default function FeaturedSpotlight({
  featured,
  secondary = [],
}: FeaturedSpotlightProps) {
  return (
    <section className="mb-10">
      <h2 className="font-bebas text-2xl text-[var(--text-primary)] tracking-wider mb-4 flex items-center gap-2">
        <span className="w-1 h-6 bg-[var(--accent)] rounded-full" />
        แนะนำพิเศษ
      </h2>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Main featured — 2/3 width */}
        <Link
          href={`/content/${featured.slug}`}
          className="lg:col-span-2 relative h-64 lg:h-80 rounded-2xl overflow-hidden group border border-[var(--border)] hover:border-[var(--text-primary)]/40 transition-all"
        >
          {featured.coverUrl ? (
            <Image
              src={featured.coverUrl}
              alt={featured.title}
              fill
              unoptimized
              className="object-cover transition-transform duration-700 group-hover:scale-105"
              priority
              sizes="(max-width: 1024px) 100vw, 66vw"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-[var(--accent)]/20 to-[var(--accent)]/20" />
          )}

          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />

          <div className="absolute bottom-0 left-0 right-0 p-6">
            <div className="flex flex-wrap gap-1 mb-2">
              {featured.genres?.slice(0, 3).map((g) => (
                <span
                  key={g}
                  className="text-xs px-2 py-0.5 rounded-full bg-[var(--text-primary)]/80 text-[var(--text-primary)] font-medium"
                >
                  {g}
                </span>
              ))}
              {featured.type && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-white/10 text-[var(--text-primary)]">
                  {featured.type}
                </span>
              )}
            </div>
            <h3 className="font-bebas text-3xl text-[var(--text-primary)] tracking-wider leading-tight">
              {featured.title}
            </h3>
            <p className="text-sm text-[var(--text-primary)] mt-1 line-clamp-2">
              {featured.description}
            </p>
            <div className="flex items-center gap-4 mt-3 text-sm text-[var(--text-secondary)]">
              {featured.rating !== undefined && (
                <span className="flex items-center gap-1">
                  <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                  {featured.rating.toFixed(1)}
                </span>
              )}
              {featured.totalViews !== undefined && (
                <span className="flex items-center gap-1">
                  <Eye className="w-4 h-4" />
                  {featured.totalViews >= 1000
                    ? `${(featured.totalViews / 1000).toFixed(1)}k`
                    : featured.totalViews}
                </span>
              )}
              {featured.latestChapter !== undefined && (
                <span className="flex items-center gap-1">
                  <BookOpen className="w-4 h-4" />
                  {featured.latestChapter} ตอน
                </span>
              )}
            </div>
          </div>
        </Link>

        {/* Side cards — 1/3 width */}
        <div className="flex flex-col gap-4">
          {secondary.slice(0, 2).map((manga) => (
            <Link
              key={manga.slug}
              href={`/content/${manga.slug}`}
              className="relative h-[calc(50%-8px)] min-h-[140px] rounded-2xl overflow-hidden group border border-[var(--border)] hover:border-[var(--text-primary)]/40 transition-all"
            >
              {manga.coverUrl ? (
                <Image
                  src={manga.coverUrl}
                  alt={manga.title}
                  fill
                  unoptimized
                  className="object-cover transition-transform duration-500 group-hover:scale-105 opacity-70"
                  sizes="(max-width: 1024px) 100vw, 33vw"
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-[var(--bg-card)] to-[var(--bg-surface)]" />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
              <div className="absolute bottom-0 p-3">
                <h4 className="font-semibold text-[var(--text-primary)] text-sm line-clamp-1">
                  {manga.title}
                </h4>
                {manga.latestChapter !== undefined && (
                  <p className="text-xs text-[var(--text-primary)] mt-0.5">
                    Ch.{manga.latestChapter}
                  </p>
                )}
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
