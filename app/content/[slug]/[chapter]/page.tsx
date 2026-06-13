import { prisma } from "@/lib/prisma";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import ReaderViewer from "@/components/ui/ReaderViewer";
import TextReader from "@/components/ui/TextReader";
import { renderNovel, novelStats } from "@/lib/markdown";
import ScrollToTop from "@/components/ui/ScrollToTop";
import CommentSection from "@/components/ui/CommentSection";
import PremiumGate from "@/components/ui/PremiumGate";
import { getUserCoins, hasUnlockedChapter } from "@/lib/coins";
import { signedImagePath } from "@/lib/imageToken";
import { evaluateAchievements } from "@/lib/achievements";
import { getRankBadges } from "@/lib/ranks";
import { isChapterLive, liveChapterWhere } from "@/lib/chapters";
import type { Metadata } from "next";

const BASE_URL = process.env.SITE_URL || process.env.NEXTAUTH_URL || "https://inksverse.com";

interface Props {
  params: Promise<{ slug: string; chapter: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug, chapter } = await params;
  const manga = await prisma.manga.findUnique({
    where: { slug },
    select: { title: true, coverUrl: true },
  });
  if (!manga) return { title: "ไม่พบมังงะ" };

  const chapterNum = parseFloat(chapter);
  const chapterTitle = `ตอนที่ ${chapterNum}`;

  return {
    title: `${manga.title} ${chapterTitle} — อ่านที่ INKVERSE`,
    description: `อ่าน ${manga.title} ${chapterTitle} แปลไทย ออนไลน์ฟรีที่ INKVERSE`,
    openGraph: {
      title: `${manga.title} ${chapterTitle} | INKVERSE`,
      ...(manga.coverUrl ? { images: [{ url: manga.coverUrl, alt: manga.title }] } : {}),
    },
    alternates: { canonical: `${BASE_URL}/content/${slug}/${chapterNum}` },
    // Index the chapter, but don't crawl outward from the reader.
    robots: { index: true, follow: false },
  };
}

export default async function ReaderPage({ params }: Props) {
  const { slug, chapter } = await params;
  const session = await auth();
  const chapterNum = parseFloat(chapter);

  const manga = await prisma.manga.findUnique({
    where: { slug },
    select: { id: true, title: true, slug: true, type: true, translator: { select: { userId: true } } },
  });
  if (!manga) notFound();

  const chapterData = await prisma.chapter.findUnique({
    where: { mangaId_chapterNum: { mangaId: manga.id, chapterNum } },
    include: {
      pages: { orderBy: { pageNum: "asc" } },
    },
  });
  if (!chapterData) notFound();

  // ── Premium gate ──────────────────────────────────────────────
  const userId = session?.user ? (session.user as { id: string }).id : null;

  // Drafts / not-yet-released chapters are visible only to the owner (preview).
  if (!isChapterLive(chapterData)) {
    const isOwnerPreview = !!userId && manga.translator?.userId === userId;
    if (!isOwnerPreview) notFound();
  }

  // Premium / early-access: still paid while freeAt is null (permanent) or in the future.
  // Once freeAt passes, the chapter is free for everyone.
  const stillPaid =
    chapterData.isPremium && (!chapterData.freeAt || chapterData.freeAt.getTime() > Date.now());
  if (stillPaid) {
    if (!userId) {
      redirect(`/auth/signin?callbackUrl=/content/${slug}/${chapter}`);
    }
    const unlocked = await hasUnlockedChapter(userId, chapterData.id);
    if (!unlocked) {
      const userCoins = await getUserCoins(userId);
      return (
        <PremiumGate
          chapterId={chapterData.id}
          chapterNum={chapterNum}
          coinCost={chapterData.coinCost}
          userCoins={userCoins}
          mangaTitle={manga.title}
          mangaSlug={slug}
          freeAt={chapterData.freeAt ? chapterData.freeAt.toISOString() : null}
        />
      );
    }
  }
  // ─────────────────────────────────────────────────────────────

  // Adjacent chapters
  const [prevChapter, nextChapter] = await Promise.all([
    prisma.chapter.findFirst({
      where: { mangaId: manga.id, chapterNum: { lt: chapterNum }, ...liveChapterWhere() },
      orderBy: { chapterNum: "desc" },
      select: { chapterNum: true },
    }),
    prisma.chapter.findFirst({
      where: { mangaId: manga.id, chapterNum: { gt: chapterNum }, ...liveChapterWhere() },
      orderBy: { chapterNum: "asc" },
      select: { chapterNum: true },
    }),
  ]);

  // Comments
  const comments = await prisma.comment.findMany({
    where: { chapterId: chapterData.id, parentId: null },
    orderBy: { createdAt: "desc" },
    take: 30,
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
  });

  // Rank badges for everyone in the thread (+ current user, for new comments).
  const rankMap = await getRankBadges([
    ...comments.map((c) => c.user.id),
    ...comments.flatMap((c) => c.replies.map((r) => r.user.id)),
    ...(userId ? [userId] : []),
  ]);
  const currentUserRank = userId ? rankMap.get(userId) ?? null : null;

  // Count views from readers only — never the creator viewing their own work.
  const isOwner = !!userId && manga.translator?.userId === userId;

  // Increment chapter views + save history
  if (!isOwner) {
    await prisma.chapter.update({
      where: { id: chapterData.id },
      data: { viewCount: { increment: 1 } },
    });
  }

  if (userId) {
    await prisma.readHistory.upsert({
      where: { userId_chapterId: { userId, chapterId: chapterData.id } },
      create: { userId, chapterId: chapterData.id, lastPage: 1 },
      update: { readAt: new Date() },
    });
    // Unlock any reading achievements this opened up (grants coins + notifies).
    await evaluateAchievements(userId);
  }

  const isNovel = manga.type === "NOVEL";

  return (
    <div>
      {isNovel ? (
        <TextReader
          html={renderNovel(chapterData.content)}
          chapterTitle={chapterData.title}
          chapterNum={chapterNum}
          mangaTitle={manga.title}
          mangaSlug={slug}
          prevChapter={prevChapter?.chapterNum ?? null}
          nextChapter={nextChapter?.chapterNum ?? null}
          minutes={novelStats(chapterData.content).minutes}
          authorNote={chapterData.authorNote}
          watermark={(session?.user as { username?: string; name?: string })?.username ?? session?.user?.name ?? "INKVERSE"}
        />
      ) : (
        <ReaderViewer
          pages={chapterData.pages.map((p) => ({
            pageNum: p.pageNum,
            src: signedImagePath(p.id),
            width: p.width,
            height: p.height,
          }))}
          chapterNum={chapterNum}
          mangaSlug={slug}
          prevChapter={prevChapter?.chapterNum ?? null}
          nextChapter={nextChapter?.chapterNum ?? null}
          watermark={(session?.user as { username?: string; name?: string })?.username ?? session?.user?.name ?? "INKVERSE"}
        />
      )}
      <ScrollToTop />

      <div className="max-w-4xl mx-auto px-4 pb-16">
        <CommentSection
          chapterId={chapterData.id}
          comments={comments.map((c) => ({
            ...c,
            createdAt: c.createdAt.toISOString(),
            likedByMe: Array.isArray(c.likedBy) && c.likedBy.length > 0,
            user: {
              username: c.user.username,
              avatarUrl: c.user.avatarUrl,
              rank: rankMap.get(c.user.id) ?? null,
            },
            replies: c.replies.map((r) => ({
              ...r,
              createdAt: r.createdAt.toISOString(),
              likedByMe: Array.isArray(r.likedBy) && r.likedBy.length > 0,
              user: {
                username: r.user.username,
                avatarUrl: r.user.avatarUrl,
                rank: rankMap.get(r.user.id) ?? null,
              },
              replies: [],
            })),
          }))}
          currentUserId={userId ?? undefined}
          currentUsername={session?.user?.name ?? undefined}
          currentUserRank={currentUserRank}
        />
      </div>
    </div>
  );
}
