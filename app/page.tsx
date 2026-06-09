import { prisma } from "@/lib/prisma";
import { getRanking } from "@/lib/ranking";
import MangaCard from "@/components/ui/MangaCard";
import FeaturedSpotlight from "@/components/ui/FeaturedSpotlight";
import UpdateRow from "@/components/ui/UpdateRow";
import RankingPanel from "@/components/ui/RankingPanel";
import GenreFilterBar from "@/components/ui/GenreFilterBar";
import HeroBanner from "@/components/ui/HeroBanner";
import Link from "next/link";
import { ChevronRight } from "lucide-react";

export const revalidate = 300; // 5 minutes

async function getData() {
  const [mangas, genres, latestChapters, weeklyRank, monthlyRank, allRank] =
    await Promise.all([
      prisma.manga.findMany({
        take: 12,
        where: { contentRating: { not: "ADULT" } },
        orderBy: { totalViews: "desc" },
        include: {
          genres: { include: { genre: true } },
          chapters: {
            orderBy: { chapterNum: "desc" },
            take: 1,
          },
          ratings: { select: { score: true } },
        },
      }),
      prisma.genre.findMany({ orderBy: { name: "asc" } }),
      prisma.chapter.findMany({
        take: 10,
        orderBy: { publishedAt: "desc" },
        where: { manga: { contentRating: { not: "ADULT" } } },
        include: {
          manga: { select: { title: true, slug: true, coverUrl: true, type: true } },
        },
      }),
      getRanking("WEEK", 10),
      getRanking("MONTH", 10),
      getRanking("ALL", 10),
    ]);

  return { mangas, genres, latestChapters, weeklyRank, monthlyRank, allRank };
}

export default async function HomePage() {
  const { mangas, genres, latestChapters, weeklyRank, monthlyRank, allRank } =
    await getData();

  const withRating = mangas.map((m) => ({
    ...m,
    avgRating:
      m.ratings.length > 0
        ? m.ratings.reduce((a, b) => a + b.score, 0) / m.ratings.length
        : 0,
    latestChapter: m.chapters[0]?.chapterNum,
    genreNames: m.genres.map((g) => g.genre.name),
  }));

  const [featured, ...rest] = withRating;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      {/* Hero */}
      {featured && (
        <HeroBanner
          title={featured.title}
          description={featured.description}
          coverUrl={featured.coverUrl}
          slug={featured.slug}
          genres={featured.genreNames}
          rating={featured.avgRating}
          latestChapter={featured.latestChapter}
        />
      )}

      {/* Genre chip filter */}
      <section className="mb-8">
        <GenreFilterBar
          genres={[
            { label: "ทั้งหมด", value: "all" },
            ...genres.map((g) => ({ label: g.name, value: g.slug })),
          ]}
        />
      </section>

      {/* Featured Spotlight */}
      {withRating.length >= 3 && (
        <FeaturedSpotlight
          featured={{
            ...withRating[1],
            genres: withRating[1].genreNames,
            rating: withRating[1].avgRating,
            totalViews: withRating[1].totalViews,
            latestChapter: withRating[1].latestChapter,
          }}
          secondary={withRating.slice(2, 4).map((m) => ({
            ...m,
            genres: m.genreNames,
            rating: m.avgRating,
            totalViews: m.totalViews,
            latestChapter: m.latestChapter,
          }))}
        />
      )}

      {/* Main content grid */}
      <div className="grid grid-cols-1 xl:grid-cols-4 gap-8">
        <div className="xl:col-span-3 space-y-10">
          {/* Latest Updates */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bebas text-2xl text-white tracking-wider flex items-center gap-2">
                <span className="w-1 h-6 bg-gradient-to-b from-[#ff2d55] to-[#ff6b2b] rounded-full" />
                อัปเดตล่าสุด
              </h2>
              <Link
                href="/manga"
                className="text-sm text-[#ff6b2b] hover:text-[#ff2d55] flex items-center gap-0.5 transition-colors"
              >
                ดูทั้งหมด <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
              {latestChapters.map((ch) => (
                <UpdateRow
                  key={ch.id}
                  slug={ch.manga.slug}
                  title={ch.manga.title}
                  coverUrl={ch.manga.coverUrl}
                  chapterNum={ch.chapterNum}
                  chapterTitle={ch.title}
                  publishedAt={ch.publishedAt}
                  isPremium={ch.isPremium}
                  type={ch.manga.type}
                />
              ))}
            </div>
          </section>

          {/* Top This Week */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bebas text-2xl text-white tracking-wider flex items-center gap-2">
                <span className="w-1 h-6 bg-gradient-to-b from-[#ff2d55] to-[#ff6b2b] rounded-full" />
                ยอดนิยมสัปดาห์นี้
              </h2>
              <Link
                href="/manga"
                className="text-sm text-[#ff6b2b] hover:text-[#ff2d55] flex items-center gap-0.5 transition-colors"
              >
                ดูทั้งหมด <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {withRating.slice(0, 8).map((manga, i) => (
                <div
                  key={manga.id}
                  className={`fade-in stagger-${Math.min(i + 1, 6) as 1 | 2 | 3 | 4 | 5 | 6}`}
                >
                  <MangaCard
                    slug={manga.slug}
                    title={manga.title}
                    coverUrl={manga.coverUrl}
                    latestChapter={manga.latestChapter}
                    rating={manga.avgRating}
                    views={manga.totalViews}
                    status={manga.status}
                    type={manga.type}
                  />
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* Sidebar Ranking */}
        <div className="xl:col-span-1">
          <div className="sticky top-20">
            <RankingPanel
              weeklyData={weeklyRank}
              monthlyData={monthlyRank}
              allTimeData={allRank}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
