import { prisma } from "@/lib/prisma";
import MangaCard from "@/components/ui/MangaCard";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

interface Props {
  params: Promise<{ genre: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { genre } = await params;
  const g = await prisma.genre.findUnique({ where: { slug: genre } });
  return { title: g ? `${g.name} มังงะ` : "หมวดหมู่" };
}

export default async function GenrePage({ params }: Props) {
  const { genre } = await params;

  const genreRecord = await prisma.genre.findUnique({ where: { slug: genre } });
  if (!genreRecord) notFound();

  const mangas = await prisma.manga.findMany({
    where: {
      genres: { some: { genreId: genreRecord.id } },
      contentRating: { not: "ADULT" },
    },
    orderBy: { totalViews: "desc" },
    take: 24,
    include: {
      chapters: { orderBy: { chapterNum: "desc" }, take: 1 },
      ratings: { select: { score: true } },
    },
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      <div className="mb-8">
        <p className="text-sm text-[var(--text-primary)] font-medium mb-1">หมวดหมู่</p>
        <h1 className="font-bebas text-5xl text-[var(--text-primary)] tracking-wider">
          {genreRecord.name}
        </h1>
        <p className="text-[var(--text-secondary)] mt-1">{mangas.length} เรื่อง</p>
      </div>

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

      {mangas.length === 0 && (
        <div className="text-center py-20 text-[var(--text-secondary)]">
          ยังไม่มีมังงะในหมวดหมู่นี้
        </div>
      )}
    </div>
  );
}
