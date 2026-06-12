import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import DashboardClient from "./DashboardClient";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Creator Dashboard | Inkverse" };

export default async function DashboardPage() {
  const session = await auth();
  const role = (session?.user as { role?: string })?.role;

  if (!session?.user) redirect("/auth/signin?callbackUrl=/dashboard");
  if (role !== "TRANSLATOR" && role !== "ADMIN") redirect("/");

  const userId = (session.user as { id?: string }).id!;

  const translator = await prisma.translator.findUnique({
    where: { userId },
    include: {
      mangas: {
        orderBy: { createdAt: "desc" },
        include: {
          genres: { include: { genre: true } },
          _count: { select: { bookmarks: true, ratings: true } },
          ratings: { select: { score: true } },
          chapters: {
            orderBy: { chapterNum: "asc" },
            include: {
              _count: { select: { comments: true } },
              unlockedBy: { select: { coinSpent: true, unlockedAt: true } },
            },
          },
        },
      },
    },
  });

  if (!translator) redirect("/apply");

  // Real baht earnings (the number creators care about most).
  const earningsAgg = await prisma.translatorEarning.aggregate({
    where: { translatorId: translator.id },
    _sum: { amount: true },
  });
  const totalEarnedBaht = earningsAgg._sum.amount ?? 0;

  // Summary aggregates
  const totalViews = translator.mangas.reduce((s, m) => s + m.totalViews, 0);
  const totalChapters = translator.mangas.reduce(
    (s, m) => s + m.chapters.length,
    0
  );
  const totalBookmarks = translator.mangas.reduce(
    (s, m) => s + m._count.bookmarks,
    0
  );
  const totalCoins = translator.mangas.reduce(
    (s, m) =>
      s +
      m.chapters.reduce(
        (cs, ch) =>
          cs + ch.unlockedBy.reduce((us, u) => us + u.coinSpent, 0),
        0
      ),
    0
  );
  const totalUnlocks = translator.mangas.reduce(
    (s, m) =>
      s + m.chapters.reduce((cs, ch) => cs + ch.unlockedBy.length, 0),
    0
  );

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const chapterIds = translator.mangas.flatMap((m) =>
    m.chapters.map((c) => c.id)
  );
  const recentReaders =
    chapterIds.length > 0
      ? await prisma.readHistory.count({
          where: { chapterId: { in: chapterIds }, readAt: { gte: sevenDaysAgo } },
        })
      : 0;

  // Per-manga stats
  const mangaStats = translator.mangas.map((m) => ({
    id: m.id,
    title: m.title,
    slug: m.slug,
    coverUrl: m.coverUrl,
    status: m.status,
    type: m.type,
    totalViews: m.totalViews,
    chapterCount: m.chapters.length,
    bookmarkCount: m._count.bookmarks,
    ratingCount: m._count.ratings,
    avgRating:
      m.ratings.length > 0
        ? m.ratings.reduce((s, r) => s + r.score, 0) / m.ratings.length
        : 0,
    unlockCount: m.chapters.reduce((s, ch) => s + ch.unlockedBy.length, 0),
    coinsEarned: m.chapters.reduce(
      (s, ch) => s + ch.unlockedBy.reduce((us, u) => us + u.coinSpent, 0),
      0
    ),
    createdAt: m.createdAt.toISOString(),
    genres: m.genres.map((g) => g.genre.name),
  }));

  // Top chapters by views
  const topChapters = translator.mangas
    .flatMap((m) =>
      m.chapters.map((ch) => ({
        id: ch.id,
        chapterNum: ch.chapterNum,
        title: ch.title,
        mangaTitle: m.title,
        mangaSlug: m.slug,
        isPremium: ch.isPremium,
        coinCost: ch.coinCost,
        viewCount: ch.viewCount,
        unlockCount: ch.unlockedBy.length,
        coinsEarned: ch.unlockedBy.reduce((s, u) => s + u.coinSpent, 0),
        commentCount: ch._count.comments,
        publishedAt: ch.publishedAt.toISOString(),
      }))
    )
    .sort((a, b) => b.viewCount - a.viewCount)
    .slice(0, 30);

  // Recent unlock events (revenue feed)
  const recentUnlocks = translator.mangas
    .flatMap((m) =>
      m.chapters.flatMap((ch) =>
        ch.unlockedBy.map((u) => ({
          chapterNum: ch.chapterNum,
          chapterTitle: ch.title,
          mangaTitle: m.title,
          mangaSlug: m.slug,
          coinSpent: u.coinSpent,
          unlockedAt: u.unlockedAt.toISOString(),
        }))
      )
    )
    .sort(
      (a, b) =>
        new Date(b.unlockedAt).getTime() - new Date(a.unlockedAt).getTime()
    )
    .slice(0, 30);

  return (
    <DashboardClient
      translator={{ penName: translator.penName, bio: translator.bio ?? "" }}
      stats={{
        totalViews,
        totalChapters,
        totalBookmarks,
        totalUnlocks,
        totalCoins,
        totalEarnedBaht,
        recentReaders,
        mangaCount: translator.mangas.length,
      }}
      mangaStats={mangaStats}
      topChapters={topChapters}
      recentUnlocks={recentUnlocks}
    />
  );
}
