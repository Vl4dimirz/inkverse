import { prisma } from "@/lib/prisma";
import MangaCard from "@/components/ui/MangaCard";
import { Suspense } from "react";
import type { Metadata } from "next";

const BASE_URL = process.env.SITE_URL || process.env.NEXTAUTH_URL || "https://inkverse.com";

export const metadata: Metadata = {
  title: "ค้นหามังงะ",
  description:
    "ค้นหามังงะ มังฮวา มันฮวาแปลไทยครบทุกแนว กรองตามหมวดหมู่ ประเทศ สถานะ และคะแนน อ่านฟรีที่ INKVERSE",
  openGraph: {
    title: "ค้นหามังงะ | INKVERSE",
    description: "ค้นหามังงะแปลไทยครบทุกแนว อ่านฟรี",
    url: `${BASE_URL}/manga`,
  },
  alternates: { canonical: `${BASE_URL}/manga` },
};

interface SearchParams {
  genre?: string;
  status?: string;
  type?: string;
  sort?: string;
  page?: string;
}

async function MangaGrid({ searchParams }: { searchParams: SearchParams }) {
  const page = Number(searchParams.page) || 1;
  const take = 24;
  const skip = (page - 1) * take;

  const where: Record<string, unknown> = {};
  if (searchParams.status) where.status = searchParams.status;
  if (searchParams.type) where.type = searchParams.type;

  const orderBy: Record<string, string> =
    searchParams.sort === "rating"
      ? { ratings: "desc" }
      : searchParams.sort === "views"
      ? { totalViews: "desc" }
      : { updatedAt: "desc" };

  const [mangas, total] = await Promise.all([
    prisma.manga.findMany({
      where,
      orderBy,
      take,
      skip,
      include: {
        chapters: { orderBy: { chapterNum: "desc" }, take: 1 },
        ratings: { select: { score: true } },
      },
    }),
    prisma.manga.count({ where }),
  ]);

  const totalPages = Math.ceil(total / take);

  return (
    <>
      <p className="text-sm text-[var(--text-secondary)] mb-4">
        พบ {total} เรื่อง
      </p>
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
              />
            </div>
          );
        })}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center gap-2 mt-10">
          {Array.from({ length: Math.min(totalPages, 10) }, (_, i) => i + 1).map(
            (p) => (
              <a
                key={p}
                href={`?page=${p}`}
                className={`w-9 h-9 flex items-center justify-center rounded-lg text-sm font-medium transition-all ${
                  p === page
                    ? "bg-[var(--text-primary)] text-[var(--bg-primary)]"
                    : "bg-[var(--bg-card)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border)]"
                }`}
              >
                {p}
              </a>
            )
          )}
        </div>
      )}
    </>
  );
}

export default async function MangaPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const genres = await prisma.genre.findMany({ orderBy: { name: "asc" } });

  const statusOptions = ["ONGOING", "COMPLETED", "HIATUS"];
  const typeOptions = ["MANGA", "MANHWA", "MANHUA", "NOVEL"];
  const sortOptions = [
    { value: "latest", label: "อัปเดตล่าสุด" },
    { value: "views", label: "ยอดชม" },
    { value: "rating", label: "คะแนน" },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      <h1 className="font-bebas text-4xl text-[var(--text-primary)] tracking-wider mb-6">
        เรื่องทั้งหมด
      </h1>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6 p-4 bg-[var(--bg-surface)] rounded-2xl border border-[var(--border)]">
        <select
          name="status"
          defaultValue={params.status || ""}
          className="bg-[var(--bg-card)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none"
        >
          <option value="">สถานะทั้งหมด</option>
          {statusOptions.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>

        <select
          name="type"
          defaultValue={params.type || ""}
          className="bg-[var(--bg-card)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none"
        >
          <option value="">ประเภททั้งหมด</option>
          {typeOptions.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>

        <select
          name="sort"
          defaultValue={params.sort || "latest"}
          className="bg-[var(--bg-card)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none"
        >
          {sortOptions.map((s) => (
            <option key={s.value} value={s.value}>
              เรียงตาม: {s.label}
            </option>
          ))}
        </select>
      </div>

      <Suspense
        fallback={
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {Array.from({ length: 24 }).map((_, i) => (
              <div key={i} className="aspect-[3/4] skeleton rounded-xl" />
            ))}
          </div>
        }
      >
        <MangaGrid searchParams={params} />
      </Suspense>
    </div>
  );
}
