import { prisma } from "@/lib/prisma";
import { getRanking } from "@/lib/ranking";
import { getRankBadges } from "@/lib/ranks";
import { liveChapterWhere } from "@/lib/chapters";
import MangaCard from "@/components/ui/MangaCard";
import FeaturedSpotlight from "@/components/ui/FeaturedSpotlight";
import UpdateRow from "@/components/ui/UpdateRow";
import RankingPanel from "@/components/ui/RankingPanel";
import GenreFilterBar from "@/components/ui/GenreFilterBar";
import HeroBanner from "@/components/ui/HeroBanner";
import ContinueReading from "@/components/ui/ContinueReading";
import DailyCheckIn from "@/components/ui/DailyCheckIn";
import TranslatorRanking from "@/components/ui/TranslatorRanking";
import Link from "next/link";
import { ChevronRight } from "lucide-react";

export const revalidate = 300; // 5 minutes

async function getData() {
  const [mangas, genres, latestChapters, weeklyRank, monthlyRank, allRank, topNovels] =
    await Promise.all([
      prisma.manga.findMany({
        take: 12,
        where: { contentRating: { not: "ADULT" }, type: { not: "NOVEL" } },
        orderBy: { totalViews: "desc" },
        include: {
          genres: { include: { genre: true } },
          chapters: {
            where: liveChapterWhere(),
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
        where: { manga: { contentRating: { not: "ADULT" }, type: { not: "NOVEL" } }, ...liveChapterWhere() },
        include: {
          manga: { select: { title: true, slug: true, coverUrl: true, type: true } },
        },
      }),
      getRanking("WEEK", 10),
      getRanking("MONTH", 10),
      getRanking("ALL", 10),
      prisma.manga.findMany({
        take: 6,
        where: { contentRating: { not: "ADULT" }, type: "NOVEL" },
        orderBy: { totalViews: "desc" },
        include: {
          chapters: { where: liveChapterWhere(), orderBy: { chapterNum: "desc" }, take: 1 },
          ratings: { select: { score: true } },
        },
      }),
    ]);

  // Top translators ranked by total views across their works.
  const agg = await prisma.manga.groupBy({
    by: ["translatorId"],
    where: { translatorId: { not: null }, contentRating: { not: "ADULT" } },
    _sum: { totalViews: true },
    _count: { _all: true },
    orderBy: { _sum: { totalViews: "desc" } },
    take: 6,
  });
  const tIds = agg.map((a) => a.translatorId).filter((x): x is string => !!x);
  const translators = await prisma.translator.findMany({
    where: { id: { in: tIds } },
    select: { id: true, penName: true, user: { select: { id: true, username: true, avatarUrl: true } } },
  });
  const tBadges = await getRankBadges(translators.map((t) => t.user.id));
  const tMap = new Map(translators.map((t) => [t.id, t]));
  const translatorRanking = agg
    .map((a) => {
      const t = a.translatorId ? tMap.get(a.translatorId) : null;
      if (!t) return null;
      return {
        penName: t.penName,
        username: t.user.username,
        avatarUrl: t.user.avatarUrl,
        views: a._sum.totalViews ?? 0,
        works: a._count._all,
        rankBadge: tBadges.get(t.user.id) ?? null,
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  const novels = topNovels.map((m) => ({
    slug: m.slug,
    title: m.title,
    coverUrl: m.coverUrl,
    type: m.type,
    status: m.status,
    totalViews: m.totalViews,
    latestChapter: m.chapters[0]?.chapterNum,
    avgRating: m.ratings.length > 0 ? m.ratings.reduce((a, b) => a + b.score, 0) / m.ratings.length : 0,
  }));

  return { mangas, genres, latestChapters, weeklyRank, monthlyRank, allRank, translatorRanking, novels };
}

export default async function HomePage() {
  const { mangas, genres, latestChapters, weeklyRank, monthlyRank, allRank, translatorRanking, novels } =
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

      {/* Daily check-in (per-user, client-fetched so the page stays cached) */}
      <DailyCheckIn />

      {/* Continue reading (per-user, client-fetched so the page stays cached) */}
      <ContinueReading />

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

      {/* Translator ranking */}
      <TranslatorRanking entries={translatorRanking} />

      {/* Main content grid */}
      <div className="grid grid-cols-1 xl:grid-cols-4 gap-8">
        <div className="xl:col-span-3 space-y-10">
          {/* Latest Updates */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bebas text-2xl text-[var(--text-primary)] tracking-[0.18em] uppercase flex items-center gap-3">
                <span className="w-6 h-px bg-[var(--text-primary)]" />
                อัปเดตล่าสุด
              </h2>
              <Link
                href="/manga"
                className="text-[11px] uppercase tracking-[0.2em] text-[var(--text-secondary)] hover:text-[var(--text-primary)] flex items-center gap-1 transition-colors"
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
              <h2 className="font-bebas text-2xl text-[var(--text-primary)] tracking-[0.18em] uppercase flex items-center gap-3">
                <span className="w-6 h-px bg-[var(--text-primary)]" />
                ยอดนิยมสัปดาห์นี้
              </h2>
              <Link
                href="/manga"
                className="text-[11px] uppercase tracking-[0.2em] text-[var(--text-secondary)] hover:text-[var(--text-primary)] flex items-center gap-1 transition-colors"
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
            {/* Browse more */}
            <div className="flex justify-center mt-6">
              <Link
                href="/manga"
                className="inline-flex items-center gap-2 px-6 py-3 border border-[var(--border)] text-[var(--text-primary)] text-sm font-semibold uppercase tracking-widest hover:bg-[var(--text-primary)] hover:text-[var(--bg-primary)] hover:border-[var(--text-primary)] transition-colors"
              >
                ดูมังงะทั้งหมด <ChevronRight className="w-4 h-4" />
              </Link>
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

      {/* Novels — kept in their own section so readers never mistake a novel for a comic */}
      {novels.length > 0 && (
        <section className="mt-14">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bebas text-2xl text-[var(--text-primary)] tracking-[0.15em] uppercase flex items-center gap-2">
              นิยายน่าอ่าน
            </h2>
            <Link
              href="/manga?type=NOVEL"
              className="text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] flex items-center gap-1 transition-colors"
            >
              ดูนิยายทั้งหมด <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4">
            {novels.map((n) => (
              <MangaCard
                key={n.slug}
                slug={n.slug}
                title={n.title}
                coverUrl={n.coverUrl}
                latestChapter={n.latestChapter}
                rating={n.avgRating}
                views={n.totalViews}
                status={n.status}
                type={n.type}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
