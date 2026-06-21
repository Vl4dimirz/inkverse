import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import MangaCard from "@/components/ui/MangaCard";
import DiscoverFilters from "@/components/ui/DiscoverFilters";
import { Search, ShieldAlert } from "lucide-react";
import Link from "next/link";
import type { Metadata } from "next";

const BASE_URL = process.env.SITE_URL || process.env.NEXTAUTH_URL || "https://inksverse.com";

export const metadata: Metadata = {
  title: "ค้นพบเรื่องใหม่ มังงะ มังฮวา มาแรง",
  description:
    "ค้นพบมังงะ มังฮวา มันฮวา และนิยายเรื่องใหม่มาแรงบน INKVERSE ค้นหาด้วยชื่อเรื่อง กรองตามแนว ประเทศ และความนิยม เจอเรื่องโปรดเรื่องต่อไปของคุณ",
  alternates: { canonical: `${BASE_URL}/discover` },
};

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
  const pageNum = Math.max(1, Math.floor(Number(page) || 1));
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

  const orderBy =
    sort === "rating"
    ? { avgRating: "desc" as const }
    : sort === "latest"
    ? { updatedAt: "desc" as const }
    : sort === "bookmarks"
    ? { bookmarkCount: "desc" as const }
    : { totalViews: "desc" as const };

  // avgRating / bookmarkCount are denormalized columns now → sort + paginate in
  // the DB (no fetch-all + JS sort).
  const [mangas, total] = await Promise.all([
    prisma.manga.findMany({
      where,
      orderBy,
      take,
      skip,
      include: { genres: { include: { genre: true } } },
    }),
    prisma.manga.count({ where }),
  ]);

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
            className="px-5 py-2.5 rounded-xl bal-btn text-sm font-medium hover:opacity-90 transition-colors"
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
                ? "bg-[var(--bg-card)] border-[var(--border)] text-[var(--text-primary)]"
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
              return (
                <div key={manga.id} className={`fade-in stagger-${Math.min(i + 1, 6) as 1|2|3|4|5|6}`}>
                  <MangaCard
                    slug={manga.slug}
                    title={manga.title}
                    coverUrl={manga.coverUrl}
                    latestChapter={manga.latestChapterNum ?? undefined}
                    rating={manga.avgRating}
                    views={manga.totalViews}
                    status={manga.status}
                    type={manga.type}
                    contentRating={manga.contentRating}
                    // First 4 items = first 2 rows on mobile (2-col grid) — above fold.
                    priority={i < 4}
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
              <span className="px-4 py-2 rounded-lg bal-btn text-sm">
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
