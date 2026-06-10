import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { cookies } from "next/headers";
import StarRating from "@/components/ui/StarRating";
import BookmarkButton from "@/components/ui/BookmarkButton";
import ChapterRow from "@/components/ui/ChapterRow";
import AgeGate from "@/components/ui/AgeGate";
import { getUserCoins } from "@/lib/coins";
import {
  BookOpen,
  Eye,
  Calendar,
  Globe,
  Tag,
  User,
} from "lucide-react";
import type { Metadata } from "next";
import { MangaJsonLd, BreadcrumbJsonLd } from "@/components/seo/JsonLd";
import BulkUnlock from "@/components/ui/BulkUnlock";

const BASE_URL = process.env.SITE_URL || process.env.NEXTAUTH_URL || "https://inkverse.com";

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
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
      ...(manga.coverUrl
        ? { images: [{ url: manga.coverUrl, width: 300, height: 400, alt: manga.title }] }
        : {}),
    },
    twitter: {
      card: "summary_large_image",
      title: `${manga.title} | INKVERSE`,
      description,
      ...(manga.coverUrl ? { images: [manga.coverUrl] } : {}),
    },
    alternates: { canonical: `${BASE_URL}/content/${manga.slug}` },
  };
}

export default async function MangaProfilePage({ params }: Props) {
  const { slug } = await params;
  const session = await auth();

  const userId = session?.user ? (session.user as { id: string }).id : null;

  const manga = await prisma.manga.findUnique({
    where: { slug },
    include: {
      genres: { include: { genre: true } },
      chapters: { orderBy: { chapterNum: "asc" } },
      ratings: { select: { score: true } },
      bookmarks: userId
        ? { where: { userId }, take: 1 }
        : false,
      translator: { include: { user: { select: { username: true } } } },
    },
  });

  if (!manga) notFound();

  // Age gate for 18+ content
  if (manga.contentRating === "ADULT") {
    const cookieStore = await cookies();
    const hasConsent = cookieStore.get("adult_consent")?.value === "1";
    if (!hasConsent) {
      return <AgeGate title={manga.title} coverUrl={manga.coverUrl} />;
    }
  }

  // Get user's coin balance + which chapters they've unlocked
  const [userCoins, unlockedSet] = await Promise.all([
    userId ? getUserCoins(userId) : Promise.resolve(0),
    userId
      ? prisma.unlockedChapter
          .findMany({ where: { userId }, select: { chapterId: true } })
          .then((rows) => new Set(rows.map((r) => r.chapterId)))
      : Promise.resolve(new Set<string>()),
  ]);

  // Increment views
  await prisma.manga.update({
    where: { id: manga.id },
    data: { totalViews: { increment: 1 } },
  });

  const avgRating =
    manga.ratings.length > 0
      ? manga.ratings.reduce((a, b) => a + b.score, 0) / manga.ratings.length
      : 0;

  const isBookmarked = userId && Array.isArray(manga.bookmarks)
    ? manga.bookmarks.length > 0
    : false;

  const latestChapter = manga.chapters[manga.chapters.length - 1];
  const firstChapter = manga.chapters[0];

  // Premium chapters the user hasn't unlocked yet (ascending) — for bulk unlock.
  const lockedPremium = manga.chapters
    .filter((ch) => ch.isPremium && !unlockedSet.has(ch.id))
    .map((ch) => ({ id: ch.id, chapterNum: ch.chapterNum, coinCost: ch.coinCost }));

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
          ratingCount: manga.ratings.length,
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
            <div className="relative aspect-[3/4] w-full max-w-[180px] mx-auto md:max-w-none rounded-2xl overflow-hidden border border-white/10 shadow-2xl">
              {manga.coverUrl ? (
                <Image
                  src={manga.coverUrl}
                  alt={manga.title}
                  fill
                  unoptimized
                  className="object-cover"
                  priority
                  sizes="(max-width: 1024px) 40vw, 25vw"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-[#1a1e2a] text-6xl opacity-20">
                  📖
                </div>
              )}
            </div>

            {/* Action buttons */}
            <div className="flex flex-col gap-2">
              {firstChapter && (
                <Link
                  href={`/content/${slug}/${firstChapter.chapterNum}`}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-[#ff2d55] to-[#ff6b2b] text-white text-sm font-semibold text-center hover:opacity-90 transition-opacity"
                >
                  อ่านตั้งแต่ต้น
                </Link>
              )}
              {latestChapter && latestChapter.id !== firstChapter?.id && (
                <Link
                  href={`/content/${slug}/${latestChapter.chapterNum}`}
                  className="w-full py-3 rounded-xl bg-[#1a1e2a] border border-white/10 text-white text-sm font-semibold text-center hover:border-white/30 transition-all"
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
            </div>

            {/* Stats */}
            <div className="bg-[#141720] rounded-xl p-4 space-y-2.5 text-sm border border-white/5">
              <div className="flex items-center gap-2 text-gray-400">
                <Eye className="w-4 h-4 text-[#ff6b2b]" />
                <span className="text-white">
                  {manga.totalViews.toLocaleString()}
                </span>
                <span>ครั้ง</span>
              </div>
              <div className="flex items-center gap-2 text-gray-400">
                <BookOpen className="w-4 h-4 text-[#ff6b2b]" />
                <span className="text-white">{manga.chapters.length}</span>
                <span>ตอน</span>
              </div>
              <div className="flex items-center gap-2 text-gray-400">
                <Globe className="w-4 h-4 text-[#ff6b2b]" />
                <span>{countryLabel[manga.originCountry] ?? manga.originCountry}</span>
              </div>
              <div className="flex items-center gap-2 text-gray-400">
                <Calendar className="w-4 h-4 text-[#ff6b2b]" />
                <span>
                  {new Date(manga.createdAt).toLocaleDateString("th-TH")}
                </span>
              </div>
              {manga.translator && (
                <div className="flex items-center gap-2 text-gray-400">
                  <User className="w-4 h-4 text-[#ff6b2b]" />
                  <span>{manga.translator.penName}</span>
                </div>
              )}
            </div>

            {/* Rating */}
            <div className="bg-[#141720] rounded-xl p-4 border border-white/5">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-400">คะแนน</span>
                <span className="text-xl font-bold text-white">
                  {avgRating.toFixed(1)}
                </span>
              </div>
              <StarRating value={avgRating} readOnly />
              <p className="text-xs text-gray-500 mt-1">
                จาก {manga.ratings.length} คนให้คะแนน
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
                    ? "bg-green-500/20 text-green-400 border border-green-500/30"
                    : manga.status === "COMPLETED"
                    ? "bg-blue-500/20 text-blue-400 border border-blue-500/30"
                    : "bg-yellow-500/20 text-yellow-400 border border-yellow-500/30"
                }`}
              >
                {statusLabel[manga.status]}
              </span>
              <span className="text-xs px-2 py-1 rounded-lg bg-[#ff2d55]/20 text-[#ff2d55] border border-[#ff2d55]/30 font-medium">
                {manga.type}
              </span>
              {manga.contentRating === "ADULT" && (
                <span className="text-xs px-2 py-1 rounded-lg bg-red-600/20 text-red-400 border border-red-600/30 font-bold">
                  18+
                </span>
              )}
              {manga.contentRating === "TEEN" && (
                <span className="text-xs px-2 py-1 rounded-lg bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 font-medium">
                  13+
                </span>
              )}
            </div>

            <h1 className="font-bebas text-4xl sm:text-5xl text-white tracking-wider leading-none mb-4">
              {manga.title}
            </h1>

            {/* Genres */}
            <div className="flex flex-wrap gap-1.5 mb-4">
              {manga.genres.map(({ genre }) => (
                <Link
                  key={genre.id}
                  href={`/manga/${genre.slug}`}
                  className="flex items-center gap-1 text-xs px-3 py-1 rounded-full bg-[#1a1e2a] text-gray-400 border border-white/10 hover:border-[#ff2d55]/40 hover:text-white transition-all"
                >
                  <Tag className="w-3 h-3" />
                  {genre.name}
                </Link>
              ))}
            </div>

            {/* Description */}
            <div className="bg-[#141720] rounded-xl p-4 border border-white/5">
              <h3 className="text-sm font-semibold text-gray-300 mb-2">
                เรื่องย่อ
              </h3>
              <p className="text-sm text-gray-400 leading-relaxed whitespace-pre-line">
                {manga.description}
              </p>
            </div>

            {/* Attribution for openly-licensed works (CC-BY etc.) */}
            {manga.license && (
              <div className="bg-[#141720] rounded-xl p-3 border border-white/5 text-xs text-gray-400">
                <span className="text-gray-500">ลิขสิทธิ์: </span>
                {manga.author && (
                  <>
                    โดย <span className="text-gray-300">{manga.author}</span> ·{" "}
                  </>
                )}
                เผยแพร่ภายใต้ <span className="text-[#ff6b2b]">{manga.license}</span>
                {manga.sourceUrl && (
                  <>
                    {" · "}
                    <a
                      href={manga.sourceUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[#ff6b2b] hover:underline"
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
            <h2 className="font-bebas text-2xl text-white tracking-wider mb-4 flex items-center gap-2">
              <span className="w-1 h-6 bg-gradient-to-b from-[#ff2d55] to-[#ff6b2b] rounded-full" />
              รายการตอน ({manga.chapters.length})
            </h2>

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
                  publishedAt={ch.publishedAt.toISOString()}
                  viewCount={ch.viewCount}
                  isUnlocked={unlockedSet.has(ch.id)}
                  mangaSlug={slug}
                  userCoins={userCoins}
                  isLoggedIn={!!userId}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
    </>
  );
}
