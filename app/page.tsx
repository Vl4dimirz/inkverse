import { Suspense } from "react";
import { prisma } from "@/lib/prisma";
import { getRanking } from "@/lib/ranking";
import { getRankBadges } from "@/lib/ranks";
import { liveChapterWhere, listedMangaWhere } from "@/lib/chapters";
import { isAppRequest, hideAdultWhen } from "@/lib/appContext";
import MangaCard from "@/components/ui/MangaCard";
import FeaturedTitles, { type FeaturedItem } from "@/components/ui/FeaturedTitles";
import UpdateRow from "@/components/ui/UpdateRow";
import RankingPanel from "@/components/ui/RankingPanel";
import GenreFilterBar from "@/components/ui/GenreFilterBar";
import PromoCarousel from "@/components/ui/PromoCarousel";
import ContinueReading from "@/components/ui/ContinueReading";
import TranslatorRanking from "@/components/ui/TranslatorRanking";
import Link from "next/link";
import { ChevronRight, SpellCheck } from "lucide-react";
import { unstable_cache } from "next/cache";
import type { Metadata } from "next";

const BASE_URL = process.env.SITE_URL || process.env.NEXTAUTH_URL || "https://inksverse.com";

export const metadata: Metadata = {
  description:
    "INKVERSE ศูนย์รวมมังงะ มังฮวา มันฮวา และนิยายแปลไทยครบทุกแนว อ่านออนไลน์ฟรี อัปเดตทุกวัน รองรับมือถือ พร้อมระบบติดตามเรื่องที่คุณชอบ",
  alternates: { canonical: BASE_URL },
};

export const revalidate = 300; // 5 minutes

// The root layout reads auth() (cookies), which forces every route to render
// dynamically — so the page-level `revalidate` above can't statically cache the
// home. Cache the heavy global queries at the data layer instead, so repeated
// requests skip the ~10 DB round-trips. (UpdateRow accepts Date|string, so the
// JSON (de)serialisation in the cache is safe.)
// `hideAdult` = true for the native app (Play Store compliance), false on the
// web (18+ shows with a badge + age gate). Cached separately per variant.
function getData(hideAdult: boolean) {
  const adult = hideAdultWhen(hideAdult);
  return unstable_cache(async () => {
  const [mangas, genres, latestChapters, weeklyRank, monthlyRank, allRank, topNovels] =
    await Promise.all([
      prisma.manga.findMany({
        take: 12,
        where: { ...listedMangaWhere(), ...adult, type: { not: "NOVEL" } },
        orderBy: { totalViews: "desc" },
        include: {
          genres: { include: { genre: true } },
        },
      }),
      // Popular genres first (most-tagged) so the home single-row genre bar shows
      // what readers browse most without scrolling; alphabetical tie-break.
      prisma.genre.findMany({
        orderBy: [{ mangas: { _count: "desc" } }, { name: "asc" }],
      }),
      prisma.chapter.findMany({
        take: 10,
        orderBy: { publishedAt: "desc" },
        // Keep admin-uploaded (non-original) works out of the Latest Updates feed
        // — it's reserved for real creators' releases. NOT(...) still includes
        // works with no translator.
        where: { manga: { ...listedMangaWhere(), ...adult, NOT: { translator: { user: { role: "ADMIN" } } } }, ...liveChapterWhere() },
        include: {
          manga: { select: { title: true, slug: true, coverUrl: true, type: true, contentRating: true } },
        },
      }),
      getRanking("WEEK", 10, hideAdult),
      getRanking("MONTH", 10, hideAdult),
      getRanking("ALL", 10, hideAdult),
      prisma.manga.findMany({
        // 8 = 2 rows of 4 in the "นิยายน่าอ่าน" grid (+ enough for 4 featured).
        take: 8,
        where: { ...listedMangaWhere(), ...adult, type: "NOVEL" },
        orderBy: { totalViews: "desc" },
        include: {
          genres: { include: { genre: true } },
        },
      }),
    ]);

  // Top translators ranked by total views across their works.
  const agg = await prisma.manga.groupBy({
    by: ["translatorId"],
    where: { ...listedMangaWhere(), translatorId: { not: null }, ...adult },
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
    description: m.description,
    type: m.type,
    status: m.status,
    totalViews: m.totalViews,
    latestChapter: m.latestChapterNum ?? undefined,
    avgRating: m.avgRating,
    contentRating: m.contentRating,
    genreNames: m.genres.map((g) => g.genre.name),
  }));

  return { mangas, genres, latestChapters, weeklyRank, monthlyRank, allRank, translatorRanking, novels };
  }, ["home-data", hideAdult ? "sfw" : "all"], { revalidate: 300, tags: ["home-feed"] })();
}

export default async function HomePage() {
  // App hides 18+ (Play Store); web shows it (badge + age gate).
  const hideAdult = await isAppRequest();
  const { mangas, genres, latestChapters, weeklyRank, monthlyRank, allRank, translatorRanking, novels } =
    await getData(hideAdult);

  const withRating = mangas.map((m) => ({
    ...m,
    avgRating: m.avgRating,
    latestChapter: m.latestChapterNum ?? undefined,
    genreNames: m.genres.map((g) => g.genre.name),
  }));

  // Editorial "เรื่องเด่น" set — interleave top manga + top novels (both with
  // cover art) so the showcase promotes creators across content types.
  const featManga: FeaturedItem[] = withRating
    .filter((m) => m.coverUrl)
    .slice(0, 4)
    .map((m) => ({
      slug: m.slug,
      title: m.title,
      coverUrl: m.coverUrl,
      description: m.description,
      genres: m.genreNames,
      type: m.type,
      rating: m.avgRating,
      views: m.totalViews,
      latestChapter: m.latestChapter,
    }));
  const featNovels: FeaturedItem[] = novels
    .filter((n) => n.coverUrl)
    .slice(0, 4)
    .map((n) => ({
      slug: n.slug,
      title: n.title,
      coverUrl: n.coverUrl,
      description: n.description,
      genres: n.genreNames,
      type: n.type,
      rating: n.avgRating,
      views: n.totalViews,
      latestChapter: n.latestChapter,
    }));
  const featuredTitles: FeaturedItem[] = [];
  for (let k = 0; k < Math.max(featManga.length, featNovels.length); k++) {
    if (featManga[k]) featuredTitles.push(featManga[k]);
    if (featNovels[k]) featuredTitles.push(featNovels[k]);
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      {/* Hero — auto-rotating promo carousel */}
      <PromoCarousel />

      {/* Continue reading (per-user, client-fetched so the page stays cached) */}
      <ContinueReading />

      {/* Genre chip filter */}
      <section className="mb-8">
        <Suspense fallback={<div className="h-9" />}>
          <GenreFilterBar
            genres={[
              { label: "ทั้งหมด", value: "all" },
              ...genres.map((g) => ({ label: g.name, value: g.slug })),
            ]}
          />
        </Suspense>
      </section>

      {/* Featured titles — rotating cover-art showcase (เรื่องเด่น) */}
      <FeaturedTitles items={featuredTitles} />

      {/* Service promo — proofreading & typesetting for writers/translators (→ /services) */}
      <Link
        href="/services"
        className="group block mb-12 border border-[var(--text-primary)] bg-[var(--bg-surface)] px-6 py-7 sm:px-10 sm:py-8"
      >
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-4">
            <SpellCheck className="w-8 h-8 shrink-0 text-[var(--text-primary)]" />
            <div>
              <p className="eyebrow mb-2">บริการโดย INKVERSE · สำหรับนักเขียน &amp; นักแปล</p>
              <h2 className="font-bebas text-2xl sm:text-3xl tracking-wider leading-none text-[var(--text-primary)]">
                พิสูจน์อักษร &amp; จัดเรียงหน้า นิยายไทย
              </h2>
              <p className="mt-2 text-sm text-[var(--text-secondary)]">
                งานเขียนสะอาด อ่านลื่น เป็นมืออาชีพ — ลูกค้าใหม่ฟรี 2,500 คำแรก
              </p>
            </div>
          </div>
          <span className="inline-flex shrink-0 items-center gap-2 self-start border border-[var(--text-primary)] px-5 py-3 text-xs font-semibold uppercase tracking-widest text-[var(--text-primary)] transition-colors group-hover:bg-[var(--text-primary)] group-hover:text-[var(--bg-primary)] sm:self-auto">
            ดูบริการ &amp; ขอราคาฟรี <ChevronRight className="w-4 h-4" />
          </span>
        </div>
      </Link>

      {/* Translator ranking */}
      <TranslatorRanking entries={translatorRanking} />

      {/* Main content grid */}
      <div className="grid grid-cols-1 xl:grid-cols-4 gap-8">
        <div className="xl:col-span-3 space-y-10">
          {/* Latest Updates — hidden entirely when there are no creator releases yet */}
          {latestChapters.length > 0 && (
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
                  contentRating={ch.manga.contentRating}
                />
              ))}
            </div>
          </section>
          )}

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
                    contentRating={manga.contentRating}
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
          {/* The "ยอดนิยม" manga grid sits in a 3/4 column (ranking sidebar beside
              it on xl), so its 4-col cards are smaller. This novels section is
              full-width, so at xl we go to 5 cols to keep the covers the SAME
              size as the manga cards (md/lg already match — no sidebar there). */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-4">
            {novels.slice(0, 8).map((n) => (
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
                contentRating={n.contentRating}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
