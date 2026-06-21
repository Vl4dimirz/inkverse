import { prisma } from "@/lib/prisma";
import { unstable_cache } from "next/cache";
import { after } from "next/server";
import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { cookies } from "next/headers";
import { decodeSlug } from "@/lib/slug";
import StarRating from "@/components/ui/StarRating";
import BookmarkButton from "@/components/ui/BookmarkButton";
import DownloadMangaButton from "@/components/ui/DownloadMangaButton";
import ShareButtons from "@/components/ui/ShareButtons";
import ChapterRow from "@/components/ui/ChapterRow";
import AgeGate from "@/components/ui/AgeGate";
import { getUserCoins } from "@/lib/coins";
import { getUserRankBadge, getRankBadges } from "@/lib/ranks";
import { liveChapterWhere, isChapterLocked } from "@/lib/chapters";
import CommentSection from "@/components/ui/CommentSection";
import MangaCard from "@/components/ui/MangaCard";
import RankChip from "@/components/ui/RankChip";
import {
  BookOpen,
  Eye,
  Calendar,
  Globe,
  Tag,
  User,
  BadgeCheck,
} from "lucide-react";
import type { Metadata } from "next";
import { MangaJsonLd, BreadcrumbJsonLd } from "@/components/seo/JsonLd";
import BulkUnlock from "@/components/ui/BulkUnlock";
import TipButton from "@/components/ui/TipButton";

const BASE_URL = process.env.SITE_URL || process.env.NEXTAUTH_URL || "https://inksverse.com";

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug: rawSlug } = await params;
  const slug = decodeSlug(rawSlug);
  const manga = await prisma.manga.findUnique({
    where: { slug },
    include: { genres: { include: { genre: true } } },
  });
  if (!manga) return { title: "ไม่พบมังงะ", description: "ไม่พบมังงะที่ต้องการ" };

  const genreNames = manga.genres.map((g) => g.genre.name).join(", ");
  const description = `อ่าน ${manga.title} แปลไทย ออนไลน์ฟรี — ${manga.description.slice(0, 120)}`;

  return {
    title: `${manga.title} — อ่านออนไลน์ฟรีที่ INKVERSE`,
    description,
    keywords: [manga.title, "อ่านออนไลน์", "แปลไทย", genreNames, "มังงะฟรี"],
    openGraph: {
      type: "book",
      title: `${manga.title} | INKVERSE`,
      description,
      url: `${BASE_URL}/content/${manga.slug}`,
      siteName: "INKVERSE",
      // No explicit image → Next uses the 1200×630 opengraph-image.tsx card.
    },
    twitter: {
      card: "summary_large_image",
      title: `${manga.title} | INKVERSE`,
      description,
    },
    alternates: { canonical: `${BASE_URL}/content/${manga.slug}` },
  };
}

// Global, per-story profile data (no per-user fields) — cached so popular
// titles don't re-hit Postgres on every visit. Dates are returned as ISO
// strings so the shape is identical whether served from cache or a fresh miss.
// Tagged per-slug (`manga:<slug>`) so publishing/editing a chapter can bust it
// immediately (see revalidateMangaCache) instead of waiting out the TTL.
function getMangaProfile(slug: string) {
  return unstable_cache(
    async () => {
      const m = await prisma.manga.findUnique({
        where: { slug },
        include: {
          genres: { include: { genre: true } },
          chapters: {
            where: liveChapterWhere(),
            orderBy: { chapterNum: "asc" },
            // List view only — never pull the chapter bodies (huge for novels).
            select: {
              id: true, chapterNum: true, title: true, isPremium: true,
              coinCost: true, viewCount: true, publishedAt: true, freeAt: true,
            },
          },
          translator: { include: { user: { select: { username: true, verifiedAt: true, role: true } } } },
        },
      });
      if (!m) return null;

      // Related works — share ≥1 genre, ranked by views (denormalized fields, so
      // no per-title ratings/chapters loads). Fall back to top works of the same
      // type if the genre overlap is thin. Hide ADULT unless this work is ADULT.
      const relSelect = {
        id: true, slug: true, title: true, coverUrl: true, type: true,
        status: true, avgRating: true, latestChapterNum: true, totalViews: true,
      };
      const notAdult = m.contentRating === "ADULT" ? {} : { contentRating: { not: "ADULT" } };
      const genreIds = m.genres.map((g) => g.genreId);
      let related = genreIds.length
        ? await prisma.manga.findMany({
            where: { id: { not: m.id }, ...notAdult, genres: { some: { genreId: { in: genreIds } } } },
            orderBy: { totalViews: "desc" },
            take: 8,
            select: relSelect,
          })
        : [];
      if (related.length < 4) {
        const fill = await prisma.manga.findMany({
          where: { id: { notIn: [m.id, ...related.map((r) => r.id)] }, ...notAdult, type: m.type },
          orderBy: { totalViews: "desc" },
          take: 8 - related.length,
          select: relSelect,
        });
        related = [...related, ...fill];
      }

      return {
        ...m,
        createdAt: m.createdAt.toISOString(),
        updatedAt: m.updatedAt.toISOString(),
        chapters: m.chapters.map((c) => ({
          ...c,
          publishedAt: c.publishedAt.toISOString(),
          freeAt: c.freeAt ? c.freeAt.toISOString() : null,
        })),
        related,
      };
    },
    ["manga-profile", slug],
    { revalidate: 120, tags: [`manga:${slug}`] }
  )();
}

export default async function MangaProfilePage({ params }: Props) {
  const { slug: rawSlug } = await params;
  const slug = decodeSlug(rawSlug);
  const session = await auth();

  const userId = session?.user ? (session.user as { id: string }).id : null;

  const manga = await getMangaProfile(slug);

  if (!manga) notFound();

  // Age gate for 18+ content
  if (manga.contentRating === "ADULT") {
    const cookieStore = await cookies();
    const hasConsent = cookieStore.get("adult_consent")?.value === "1";
    if (!hasConsent) {
      return <AgeGate title={manga.title} coverUrl={manga.coverUrl} />;
    }
  }

  const isOwner = !!userId && manga.translator?.userId === userId;

  // Scope the per-user chapter lookups to THIS manga's chapters (PK-bounded `in`)
  // instead of scanning the reader's entire site-wide unlock/read history. A heavy
  // reader can have thousands of unlocked/read rows; we only ever need the ones
  // for the chapters rendered on this page.
  const chapterIds = manga.chapters.map((c) => c.id);

  // One parallel round-trip for everything that depends on the loaded manga:
  // balance, unlocked/read sets, work-level comments, uploader rank, view bump.
  const [userCoins, unlockedSet, readSet, workComments, translatorRank, bookmarkRow] = await Promise.all([
    userId ? getUserCoins(userId) : Promise.resolve(0),
    userId && chapterIds.length
      ? prisma.unlockedChapter
          .findMany({ where: { userId, chapterId: { in: chapterIds } }, select: { chapterId: true } })
          .then((rows) => new Set(rows.map((r) => r.chapterId)))
      : Promise.resolve(new Set<string>()),
    userId && chapterIds.length
      ? prisma.readHistory
          .findMany({ where: { userId, chapterId: { in: chapterIds } }, select: { chapterId: true } })
          .then((rows) => new Set(rows.map((r) => r.chapterId)))
      : Promise.resolve(new Set<string>()),
    prisma.comment.findMany({
      where: { mangaId: manga.id, parentId: null },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: {
        user: { select: { id: true, username: true, avatarUrl: true } },
        likedBy: userId ? { where: { userId }, select: { id: true } } : false,
        replies: {
          include: {
            user: { select: { id: true, username: true, avatarUrl: true } },
            likedBy: userId ? { where: { userId }, select: { id: true } } : false,
          },
          orderBy: { createdAt: "asc" },
          take: 10,
        },
      },
    }),
    manga.translator
      ? getUserRankBadge(manga.translator.userId, manga.translator.user.role)
      : Promise.resolve(null),
    userId
      ? prisma.bookmark.findUnique({
          where: { userId_mangaId: { userId, mangaId: manga.id } },
          select: { userId: true },
        })
      : Promise.resolve(null),
  ]);

  // Bump the view counter AFTER the response streams — never block TTFB on a write.
  if (!isOwner) {
    after(() =>
      prisma.manga
        .update({ where: { id: manga.id }, data: { totalViews: { increment: 1 } } })
        .catch(() => {})
    );
  }

  // Reading progress (chapters opened / total)
  const readCount = manga.chapters.filter((ch) => readSet.has(ch.id)).length;
  const readPercent =
    manga.chapters.length > 0
      ? Math.round((readCount / manga.chapters.length) * 100)
      : 0;

  // Denormalized stats (lib/mangaStats) — no per-title ratings load.
  const avgRating = manga.avgRating;
  const ratingCount = manga.ratingCount;

  const isBookmarked = !!bookmarkRow;

  const latestChapter = manga.chapters[manga.chapters.length - 1];
  const firstChapter = manga.chapters[0];

  // Chapters offered in the offline-download picker (locked premium = not saveable).
  const downloadableChapters = manga.chapters.map((ch) => ({
    id: ch.id,
    chapterNum: ch.chapterNum,
    title: ch.title,
    locked: !isOwner && isChapterLocked(ch, unlockedSet.has(ch.id)),
  }));

  // Premium chapters the user hasn't unlocked yet (ascending) — for bulk unlock.
  const lockedPremium = manga.chapters
    .filter((ch) => isChapterLocked(ch, unlockedSet.has(ch.id)))
    .map((ch) => ({ id: ch.id, chapterNum: ch.chapterNum, coinCost: ch.coinCost }));

  // Rank badges for the thread — skip the (multi-query) lookup entirely when
  // there are no comments yet (common, and the single biggest content-page cost).
  const rankIds = [
    ...workComments.map((c) => c.user.id),
    ...workComments.flatMap((c) => c.replies.map((r) => r.user.id)),
  ];
  const commentRankMap =
    rankIds.length > 0
      ? await getRankBadges([...rankIds, ...(userId ? [userId] : [])])
      : new Map();
  const currentUserRank = userId ? commentRankMap.get(userId) ?? null : null;
  const workCommentData = workComments.map((c) => ({
    ...c,
    createdAt: c.createdAt.toISOString(),
    likedByMe: Array.isArray(c.likedBy) && c.likedBy.length > 0,
    user: { username: c.user.username, avatarUrl: c.user.avatarUrl, rank: commentRankMap.get(c.user.id) ?? null },
    replies: c.replies.map((r) => ({
      ...r,
      createdAt: r.createdAt.toISOString(),
      likedByMe: Array.isArray(r.likedBy) && r.likedBy.length > 0,
      user: { username: r.user.username, avatarUrl: r.user.avatarUrl, rank: commentRankMap.get(r.user.id) ?? null },
      replies: [],
    })),
  }));

  const statusLabel: Record<string, string> = {
    ONGOING: "กำลังดำเนินเรื่อง",
    COMPLETED: "จบแล้ว",
    HIATUS: "หยุดพัก",
  };

  const countryLabel: Record<string, string> = {
    JP: "🇯🇵 ญี่ปุ่น",
    KR: "🇰🇷 เกาหลี",
    CN: "🇨🇳 จีน",
    TH: "🇹🇭 ไทย",
    FR: "🇫🇷 ฝรั่งเศส",
  };

  return (
    <>
      <MangaJsonLd
        manga={{
          title: manga.title,
          slug: manga.slug,
          description: manga.description,
          coverUrl: manga.coverUrl,
          status: manga.status,
          updatedAt: manga.updatedAt,
          genres: manga.genres,
          avgRating,
          ratingCount,
          chapters: manga.chapters,
        }}
      />
      <BreadcrumbJsonLd
        items={[
          { name: "หน้าแรก", url: BASE_URL },
          { name: "มังงะ", url: `${BASE_URL}/manga` },
          { name: manga.title, url: `${BASE_URL}/content/${manga.slug}` },
        ]}
      />
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      <div className="grid grid-cols-1 md:grid-cols-[180px_1fr] lg:grid-cols-4 gap-6 lg:gap-8">
        {/* Left — Cover + Info */}
        <div className="md:col-span-1 lg:col-span-1">
          <div className="md:sticky md:top-20 space-y-4">
            {/* Cover */}
            <div className="relative aspect-[3/4] w-full max-w-[180px] mx-auto md:max-w-none rounded-2xl overflow-hidden border border-[var(--border)] ">
              {manga.coverUrl ? (
                <Image
                  src={manga.coverUrl}
                  alt={manga.title}
                  fill
                  unoptimized
                  className="object-cover"
                  // `preload` is the Next.js 16 replacement for deprecated `priority`.
                  // This is the hero cover and the LCP element on this page.
                  preload
                  fetchPriority="high"
                  loading="eager"
                  // The cover column is capped at 180 px (max-w-[180px] on mobile;
                  // a 180 px grid column on md+). The previous "40vw" overstated the
                  // rendered width on tablets (307 px for a 180 px slot).
                  sizes="180px"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-[var(--bg-card)] text-6xl opacity-20">
                  📖
                </div>
              )}
            </div>

            {/* Action buttons */}
            <div className="flex flex-col gap-2">
              {firstChapter && (
                <Link
                  href={`/content/${slug}/${firstChapter.chapterNum}`}
                  className="w-full py-3 rounded-xl bal-btn text-sm font-semibold text-center hover:opacity-90 transition-colors"
                >
                  อ่านตั้งแต่ต้น
                </Link>
              )}
              {latestChapter && latestChapter.id !== firstChapter?.id && (
                <Link
                  href={`/content/${slug}/${latestChapter.chapterNum}`}
                  className="w-full py-3 rounded-xl bg-[var(--bg-card)] border border-[var(--border)] text-[var(--text-primary)] text-sm font-semibold text-center hover:border-white/30 transition-all"
                >
                  อ่านตอนล่าสุด
                </Link>
              )}
              {session?.user && (
                <BookmarkButton
                  mangaId={manga.id}
                  initialBookmarked={isBookmarked}
                />
              )}
              {/* App-only: renders nothing on the web (returns null) */}
              <DownloadMangaButton
                mangaSlug={manga.slug}
                mangaTitle={manga.title}
                chapters={downloadableChapters}
              />
            </div>

            {/* Share — turns every reader into a distribution channel */}
            <div className="mb-3">
              <ShareButtons url={`${BASE_URL}/content/${manga.slug}`} title={manga.title} />
            </div>

            {/* Stats */}
            <div className="bg-[var(--bg-surface)] rounded-xl p-4 space-y-2.5 text-sm border border-[var(--border)]">
              <div className="flex items-center gap-2 text-[var(--text-secondary)]">
                <Eye className="w-4 h-4 text-[var(--text-primary)]" />
                <span className="text-[var(--text-primary)]">
                  {manga.totalViews.toLocaleString()}
                </span>
                <span>ครั้ง</span>
              </div>
              <div className="flex items-center gap-2 text-[var(--text-secondary)]">
                <BookOpen className="w-4 h-4 text-[var(--text-primary)]" />
                <span className="text-[var(--text-primary)]">{manga.chapters.length}</span>
                <span>ตอน</span>
              </div>
              <div className="flex items-center gap-2 text-[var(--text-secondary)]">
                <Globe className="w-4 h-4 text-[var(--text-primary)]" />
                <span>{countryLabel[manga.originCountry] ?? manga.originCountry}</span>
              </div>
              <div className="flex items-center gap-2 text-[var(--text-secondary)]">
                <Calendar className="w-4 h-4 text-[var(--text-primary)]" />
                <span>
                  {new Date(manga.createdAt).toLocaleDateString("th-TH")}
                </span>
              </div>
              {manga.translator && (
                <div className="flex items-center gap-2 text-[var(--text-secondary)]">
                  <User className="w-4 h-4 text-[var(--text-primary)]" />
                  <span>{manga.translator.penName}</span>
                </div>
              )}
            </div>

            {/* Rating */}
            <div className="bg-[var(--bg-surface)] rounded-xl p-4 border border-[var(--border)]">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-[var(--text-secondary)]">คะแนน</span>
                <span className="text-xl font-bold text-[var(--text-primary)]">
                  {avgRating.toFixed(1)}
                </span>
              </div>
              <StarRating value={avgRating} readOnly />
              <p className="text-xs text-[var(--text-secondary)] mt-1">
                จาก {ratingCount} คนให้คะแนน
              </p>
            </div>
          </div>
        </div>

        {/* Right — Details + Chapters */}
        <div className="md:col-span-1 lg:col-span-3 space-y-6">
          {/* Header */}
          <div>
            <div className="flex flex-wrap gap-2 mb-2">
              <span
                className={`text-xs px-2 py-1 rounded-lg font-medium ${
                  manga.status === "ONGOING"
                    ? "bg-[var(--bg-card)] text-[var(--text-primary)] border border-[var(--border)]"
                    : manga.status === "COMPLETED"
                    ? "bg-[var(--bg-card)] text-[var(--text-secondary)] border border-[var(--border)]"
                    : "bg-[var(--bg-card)] text-[var(--text-primary)] border border-[var(--border)]"
                }`}
              >
                {statusLabel[manga.status]}
              </span>
              <span className="text-xs px-2 py-1 rounded-lg bg-[var(--text-primary)]/20 text-[var(--text-primary)] border border-[var(--text-primary)]/30 font-medium">
                {manga.type}
              </span>
              {manga.contentRating === "ADULT" && (
                <span className="text-xs px-2 py-1 rounded-lg bg-[var(--bg-card)] text-[var(--text-primary)] border border-[var(--border)] font-bold">
                  18+
                </span>
              )}
              {manga.contentRating === "TEEN" && (
                <span className="text-xs px-2 py-1 rounded-lg bg-[var(--bg-card)] text-[var(--text-primary)] border border-[var(--border)] font-medium">
                  13+
                </span>
              )}
            </div>

            <h1 className="font-bebas text-4xl sm:text-5xl text-[var(--text-primary)] tracking-wider leading-none mb-3">
              {manga.title}
            </h1>

            {/* Uploaded by */}
            {manga.translator ? (
              <div className="flex flex-wrap items-center gap-3 mb-4">
                <Link
                  href={`/profile/${manga.translator.user.username}`}
                  className="inline-flex items-center gap-1.5 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
                >
                  <User className="w-4 h-4 text-[var(--text-primary)]" />
                  ลงโดย <span className="text-[var(--text-primary)] font-medium">{manga.translator.penName}</span>
                  {manga.translator.user.verifiedAt && (
                    <BadgeCheck className="w-4 h-4 text-[var(--text-primary)]" />
                  )}
                  {translatorRank && <RankChip badge={translatorRank} />}
                </Link>
                <TipButton
                  translatorId={manga.translator.id}
                  penName={manga.translator.penName}
                  isLoggedIn={!!session?.user}
                />
              </div>
            ) : manga.author ? (
              <p className="inline-flex items-center gap-1.5 text-sm text-[var(--text-secondary)] mb-4">
                <User className="w-4 h-4 text-[var(--text-primary)]" />
                โดย <span className="text-[var(--text-primary)] font-medium">{manga.author}</span>
              </p>
            ) : null}

            {/* Genres */}
            <div className="flex flex-wrap gap-1.5 mb-4">
              {manga.genres.map(({ genre }) => (
                <Link
                  key={genre.id}
                  href={`/manga/${genre.slug}`}
                  className="flex items-center gap-1 text-xs px-3 py-1 rounded-full bg-[var(--bg-card)] text-[var(--text-secondary)] border border-[var(--border)] hover:border-[var(--text-primary)]/40 hover:text-[var(--text-primary)] transition-all"
                >
                  <Tag className="w-3 h-3" />
                  {genre.name}
                </Link>
              ))}
            </div>

            {/* Custom tags */}
            {manga.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-4">
                {manga.tags.map((t) => (
                  <Link
                    key={t}
                    href={`/manga?tag=${encodeURIComponent(t)}`}
                    className="text-xs px-2.5 py-1 rounded-full bg-[var(--bg-surface)] text-[var(--text-secondary)] border border-[var(--border)] hover:border-[var(--text-primary)]/40 hover:text-[var(--text-primary)] transition-all"
                  >
                    #{t}
                  </Link>
                ))}
              </div>
            )}

            {/* Description */}
            <div className="bg-[var(--bg-surface)] rounded-xl p-4 border border-[var(--border)]">
              <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-2">
                เรื่องย่อ
              </h3>
              <p className="text-sm text-[var(--text-secondary)] leading-relaxed whitespace-pre-line">
                {manga.description}
              </p>
            </div>

            {/* Good-faith notice on works uploaded by the site admin (not the
                admin's own translation; free, non-commercial; removed on request). */}
            {manga.translator?.user?.role === "ADMIN" && (
              <div className="bg-[var(--bg-surface)] rounded-xl p-4 border border-[var(--border)] text-xs text-[var(--text-secondary)] leading-relaxed">
                <p className="text-[var(--text-primary)] font-semibold mb-1.5">หมายเหตุ</p>
                <p>
                  ผลงานนี้ไม่ใช่ผลงานแปลของผู้ดูแลเว็บเอง และไม่มีเจตนานำมาใช้เพื่อแสวงหารายได้
                  เผยแพร่ผ่านเว็บเพื่อให้อ่านฟรีเท่านั้น
                </p>
                <p className="mt-1.5">
                  หากนักแปลท่านใดต้องการลงผลงานแปล (original) ของเรื่องเดียวกันนี้
                  ทางเว็บยินดีลบงานนี้ให้ทันทีเพื่อให้ท่านได้ลงผลงานของท่านเอง — ติดต่อได้ที่{" "}
                  <Link href="/contact" className="text-[var(--text-primary)] underline hover:no-underline">หน้าติดต่อ</Link>
                </p>
              </div>
            )}

            {/* Attribution for openly-licensed works (CC-BY etc.) */}
            {manga.license && (
              <div className="bg-[var(--bg-surface)] rounded-xl p-3 border border-[var(--border)] text-xs text-[var(--text-secondary)]">
                <span className="text-[var(--text-secondary)]">ลิขสิทธิ์: </span>
                {manga.author && (
                  <>
                    โดย <span className="text-[var(--text-primary)]">{manga.author}</span> ·{" "}
                  </>
                )}
                เผยแพร่ภายใต้ <span className="text-[var(--text-primary)]">{manga.license}</span>
                {manga.sourceUrl && (
                  <>
                    {" · "}
                    <a
                      href={manga.sourceUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[var(--text-primary)] hover:underline"
                    >
                      ที่มา
                    </a>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Chapter list */}
          <div>
            <h2 className="font-bebas text-2xl text-[var(--text-primary)] tracking-wider mb-4 flex items-center gap-2">
              <span className="w-1 h-6 bg-[var(--accent)] rounded-full" />
              รายการตอน ({manga.chapters.length})
            </h2>

            {/* Reading progress */}
            {userId && (
              <div className="mb-4">
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <span className="uppercase tracking-wide text-[var(--text-secondary)]">
                    ความคืบหน้า
                  </span>
                  <span className="font-semibold text-[var(--text-primary)]">
                    อ่านแล้ว {readPercent}%{" "}
                    <span className="text-[var(--text-secondary)] font-normal">
                      ({readCount}/{manga.chapters.length} ตอน)
                    </span>
                  </span>
                </div>
                <div className="h-1.5 w-full bg-[var(--bg-card)] border border-[var(--border)] overflow-hidden">
                  <div
                    className="h-full bg-[var(--text-primary)] transition-all"
                    style={{ width: `${readPercent}%` }}
                  />
                </div>
              </div>
            )}

            {lockedPremium.length > 0 && (
              <div className="mb-4">
                <BulkUnlock
                  chapters={lockedPremium}
                  userCoins={userCoins}
                  isLoggedIn={!!userId}
                />
              </div>
            )}

            <div className="space-y-1 max-h-[600px] overflow-y-auto pr-1">
              {[...manga.chapters].reverse().map((ch) => (
                <ChapterRow
                  key={ch.id}
                  id={ch.id}
                  chapterNum={ch.chapterNum}
                  title={ch.title}
                  isPremium={ch.isPremium}
                  coinCost={ch.coinCost}
                  publishedAt={ch.publishedAt}
                  viewCount={ch.viewCount}
                  isUnlocked={unlockedSet.has(ch.id)}
                  isRead={readSet.has(ch.id)}
                  mangaSlug={slug}
                  userCoins={userCoins}
                  isLoggedIn={!!userId}
                  freeAt={ch.freeAt}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>

      {/* Related works — keep readers browsing (shared genres, view-ranked) */}
      {manga.related.length > 0 && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 pb-4">
          <h2 className="font-bebas text-2xl text-[var(--text-primary)] tracking-[0.18em] uppercase flex items-center gap-3 mb-4">
            <span className="w-6 h-px bg-[var(--text-primary)]" />
            เรื่องที่เกี่ยวข้อง
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {manga.related.map((r) => (
              <MangaCard
                key={r.id}
                slug={r.slug}
                title={r.title}
                coverUrl={r.coverUrl}
                latestChapter={r.latestChapterNum ?? undefined}
                rating={r.avgRating}
                views={r.totalViews}
                status={r.status}
                type={r.type}
              />
            ))}
          </div>
        </section>
      )}

      {/* Work-level comments — readers discuss the whole story (key for novels) */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 pb-16">
        <CommentSection
          mangaId={manga.id}
          comments={workCommentData}
          currentUserId={userId ?? undefined}
          currentUsername={session?.user?.name ?? undefined}
          currentUserRank={currentUserRank}
        />
      </section>
    </>
  );
}
