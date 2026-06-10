import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import MangaCard from "@/components/ui/MangaCard";
import DiscoverFilters from "@/components/ui/DiscoverFilters";
import { Search, ShieldAlert } from "lucide-react";
import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "ค้นหามังงะ" };

interface SearchParams {
  q?: string;
  genre?: string;
  status?: string;
  type?: string;
  country?: string;
  sort?: string;
  page?: string;
  adult?: string;
}

export default async function DiscoverPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const { q, genre, status, type, country, sort = "views", page = "1", adult } = params;
  const pageNum = Number(page);
  const take = 24;
  const skip = (pageNum - 1) * take;

  // Check adult consent
  const cookieStore = await cookies();
  const hasConsent = cookieStore.get("adult_consent")?.value === "1";
  const showAdult = adult === "1" && hasConsent;

  const genres = await prisma.genre.findMany({ orderBy: { name: "asc" } });

  const where: Record<string, unknown> = {};
  if (q) {
    where.title = { contains: q, mode: "insensitive" };
  }
  if (status) where.status = status;
  if (type) where.type = type;
  if (country) where.originCountry = country;
  if (!showAdult) {
    where.contentRating = { not: "ADULT" };
  }
  if (genre) {
    const g = await prisma.genre.findUnique({ where: { slug: genre } });
    if (g) where.genres = { some: { genreId: g.id } };
  }

  const isRatingSort = sort === "rating";
  const orderBy = isRatingSort
    ? { totalViews: "desc" as const }
    : sort === "latest"
    ? { updatedAt: "desc" as const }
    : sort === "bookmarks"
    ? { bookmarks: { _count: "desc" as const } }
    : { totalViews: "desc" as const };

  const [fetched, total] = await Promise.all([
    prisma.manga.findMany({
      where,
      orderBy,
      take: isRatingSort ? undefined : take,
      skip: isRatingSort ? undefined : skip,
      include: {
        genres: { include: { genre: true } },
        chapters: { orderBy: { chapterNum: "desc" }, take: 1 },
        ratings: { select: { score: true } },
      },
    }),
    prisma.manga.count({ where }),
  ]);

  let mangas = fetched;
  if (isRatingSort) {
    mangas.sort((a, b) => {
      const avgA = a.ratings.length > 0 ? a.ratings.reduce((s, r) => s + r.score, 0) / a.ratings.length : 0;
      const avgB = b.ratings.length > 0 ? b.ratings.reduce((s, r) => s + r.score, 0) / b.ratings.length : 0;
      return avgB - avgA;
    });
    mangas = mangas.slice(skip, skip + take);
  }

  const totalPages = Math.ceil(total / take);

  function buildUrl(overrides: Partial<SearchParams>) {
    const p = { q, genre, status, type, country, sort, page, adult, ...overrides };
    const qs = Object.entries(p)
      .filter(([, v]) => v)
      .map(([k, v]) => `${k}=${encodeURIComponent(v!)}`)
      .join("&");
    return `/discover?${qs}`;
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      <h1 className="font-bebas text-4xl text-[var(--text-primary)] tracking-wider mb-6 flex items-center gap-3">
        <Search className="w-8 h-8 text-[var(--text-primary)]" />
        ค้นหามังงะ
      </h1>

      {/* Search + Filter bar */}
      <div className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border)] p-4 mb-8 space-y-4">
        <form className="flex gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-secondary)]" />
            <input
              name="q"
              defaultValue={q || ""}
              placeholder="ค้นหาชื่อเรื่อง..."
              className="w-full bg-[var(--bg-card)] border border-[var(--border)] rounded-xl pl-9 pr-4 py-2.5 text-sm text-[var(--text-primary)] placeholder-gray-500 focus:outline-none focus:border-[var(--text-primary)]/50"
            />
          </div>
          <button
            type="submit"
            className="px-5 py-2.5 rounded-xl bg-[var(--text-primary)] text-[var(--bg-primary)] text-sm font-medium hover:opacity-90 transition-opacity"
          >
            ค้นหา
          </button>
        </form>

        <DiscoverFilters
          genres={genres}
          current={{ q, genre, status, type, country, sort }}
        />
      </div>

      {/* Adult content toggle */}
      {hasConsent && (
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm text-[var(--text-secondary)]">
            {q && (
              <span>
                ผลการค้นหา &quot;<span className="text-[var(--text-primary)]">{q}</span>&quot; —{" "}
              </span>
            )}
            พบ {total} เรื่อง
          </p>
          <Link
            href={buildUrl({ adult: showAdult ? undefined : "1", page: "1" })}
            className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-xl border transition-all ${
              showAdult
                ? "bg-red-500/20 border-red-500/30 text-red-400"
                : "bg-white/5 border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            }`}
          >
            <ShieldAlert className="w-3.5 h-3.5" />
            เนื้อหา 18+{showAdult ? " (เปิดอยู่)" : ""}
          </Link>
        </div>
      )}
      {!hasConsent && (
        <p className="text-sm text-[var(--text-secondary)] mb-4">
          {q && (
            <span>
              ผลการค้นหา &quot;<span className="text-[var(--text-primary)]">{q}</span>&quot; —{" "}
            </span>
          )}
          พบ {total} เรื่อง
        </p>
      )}

      {mangas.length > 0 ? (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {mangas.map((manga, i) => {
              const avgRating =
                manga.ratings.length > 0
                  ? manga.ratings.reduce((a, b) => a + b.score, 0) /
                    manga.ratings.length
                  : 0;
              return (
                <div key={manga.id} className={`fade-in stagger-${Math.min(i + 1, 6) as 1|2|3|4|5|6}`}>
                  <MangaCard
                    slug={manga.slug}
                    title={manga.title}
                    coverUrl={manga.coverUrl}
                    latestChapter={manga.chapters[0]?.chapterNum}
                    rating={avgRating}
                    views={manga.totalViews}
                    status={manga.status}
                    type={manga.type}
                    contentRating={manga.contentRating}
                  />
                </div>
              );
            })}
          </div>

          {totalPages > 1 && (
            <div className="flex justify-center gap-2 mt-10">
              {pageNum > 1 && (
                <a
                  href={buildUrl({ page: String(pageNum - 1) })}
                  className="px-4 py-2 rounded-lg bg-[var(--bg-card)] border border-[var(--border)] text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
                >
                  ← ก่อนหน้า
                </a>
              )}
              <span className="px-4 py-2 rounded-lg bg-[var(--text-primary)] text-[var(--bg-primary)] text-sm">
                {pageNum} / {totalPages}
              </span>
              {pageNum < totalPages && (
                <a
                  href={buildUrl({ page: String(pageNum + 1) })}
                  className="px-4 py-2 rounded-lg bg-[var(--bg-card)] border border-[var(--border)] text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
                >
                  ถัดไป →
                </a>
              )}
            </div>
          )}
        </>
      ) : (
        <div className="text-center py-20">
          <div className="text-6xl mb-4">🔍</div>
          <p className="text-[var(--text-secondary)]">ไม่พบผลลัพธ์ที่ตรงกัน</p>
          <p className="text-sm text-[var(--text-muted)] mt-1">ลองเปลี่ยนคำค้นหาหรือตัวกรอง</p>
        </div>
      )}
    </div>
  );
}
