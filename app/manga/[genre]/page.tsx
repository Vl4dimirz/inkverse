import { prisma } from "@/lib/prisma";
import MangaCard from "@/components/ui/MangaCard";
import Pagination from "@/components/ui/Pagination";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

const BASE_URL = process.env.SITE_URL || process.env.NEXTAUTH_URL || "https://inksverse.com";

interface Props {
  params: Promise<{ genre: string }>;
  searchParams: Promise<{ page?: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { genre } = await params;
  const g = await prisma.genre.findUnique({ where: { slug: genre } });
  if (!g) return { title: "หมวดหมู่" };
  const name = g.name;
  const title = `อ่าน${name} แปลไทย ออนไลน์ฟรี — มังงะ มังฮวา นิยาย`;
  const description = `รวม${name}แปลไทยครบทุกเรื่อง อ่านฟรีไม่มีโฆษณา อัปเดตตอนใหม่ทุกวัน — มังงะ มังฮวา มันฮวา และนิยายแนว${name} ที่ INKVERSE`;
  const url = `${BASE_URL}/manga/${genre}`;
  return {
    title,
    description,
    keywords: [name, `${name}แปลไทย`, `อ่าน${name}`, "แปลไทย", "อ่านฟรี", "มังงะ", "มังฮวา", "มันฮวา", "นิยาย", "webtoon"],
    alternates: { canonical: url },
    openGraph: { title: `${name} แปลไทย | INKVERSE`, description, url, siteName: "INKVERSE", type: "website" },
  };
}

export default async function GenrePage({ params, searchParams }: Props) {
  const { genre } = await params;
  const page = Math.max(1, Math.floor(Number((await searchParams).page) || 1));
  const take = 24;

  const genreRecord = await prisma.genre.findUnique({ where: { slug: genre } });
  if (!genreRecord) notFound();

  const where = {
    genres: { some: { genreId: genreRecord.id } },
    contentRating: { not: "ADULT" as const },
  };
  const [mangas, total] = await Promise.all([
    prisma.manga.findMany({
      where,
      orderBy: { totalViews: "desc" },
      take,
      skip: (page - 1) * take,
    }),
    prisma.manga.count({ where }),
  ]);
  const totalPages = Math.ceil(total / take);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      <div className="mb-8">
        <p className="text-sm text-[var(--text-primary)] font-medium mb-1">หมวดหมู่</p>
        <h1 className="font-bebas text-5xl text-[var(--text-primary)] tracking-wider">
          {genreRecord.name} แปลไทย
        </h1>
        <p className="text-[var(--text-secondary)] mt-2 max-w-2xl text-sm leading-relaxed">
          รวมมังงะ มังฮวา มันฮวา และนิยายแนว{genreRecord.name} แปลไทยทั้งหมด {total} เรื่อง —
          อ่านฟรีออนไลน์ ไม่มีโฆษณา อัปเดตตอนใหม่ทุกวันที่ INKVERSE
        </p>
      </div>

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
              />
            </div>
          );
        })}
      </div>

      {mangas.length === 0 && (
        <div className="text-center py-20 text-[var(--text-secondary)]">
          ยังไม่มีมังงะในหมวดหมู่นี้
        </div>
      )}

      <Pagination page={page} totalPages={totalPages} />
    </div>
  );
}
