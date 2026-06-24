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
import { Suspense } from "react";
import { after } from "next/server";
import { decodeSlug } from "@/lib/slug";

const BASE_URL = process.env.SITE_URL || process.env.NEXTAUTH_URL || "https://inksverse.com";

interface Props {
  params: Promise<{ slug: string; chapter: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug: rawSlug, chapter } = await params;
  const slug = decodeSlug(rawSlug);
  const manga = await prisma.manga.findUnique({
    where: { slug },
    select: { title: true, coverUrl: true, published: true },
  });
  if (!manga) return { title: "ไม่พบมังงะ" };
  // Unpublished story → don't leak the title in <head> (body 404s for non-owners).
  if (!manga.published) return { title: "INKVERSE", robots: { index: false } };

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
  const { slug: rawSlug, chapter } = await params;
  const slug = decodeSlug(rawSlug);
  const chapterNum = parseFloat(chapter);

  // auth() and the manga lookup are independent → run them together.
  const [session, manga] = await Promise.all([
    auth(),
    prisma.manga.findUnique({
      where: { slug },
      select: { id: true, title: true, slug: true, type: true, coverUrl: true, published: true, translator: { select: { userId: true } } },
    }),
  ]);
  if (!manga) notFound();

  const userId = session?.user ? (session.user as { id: string }).id : null;
  const isAdmin = (session?.user as { role?: string } | undefined)?.role === "ADMIN";
  const isOwnerPreview = (!!userId && manga.translator?.userId === userId) || isAdmin;

  // Story-level unpublish: a hidden เรื่อง's chapters 404 for everyone except the
  // owner/admin (live preview) — mirrors the per-chapter draft gate below.
  if (!manga.published && !isOwnerPreview) notFound();

  // The chapter body and the adjacent-chapter (prev/next) lookups both depend
  // only on manga.id + chapterNum, not on each other → fetch all three at once.
  const [chapterData, [prevChapter, nextChapter]] = await Promise.all([
    prisma.chapter.findUnique({
      where: { mangaId_chapterNum: { mangaId: manga.id, chapterNum } },
      include: { pages: { orderBy: { pageNum: "asc" } } },
    }),
    Promise.all([
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
    ]),
  ]);
  if (!chapterData) notFound();

  // ── Premium gate ──────────────────────────────────────────────
  // Drafts / not-yet-released chapters are visible only to the owner (preview).
  if (!isChapterLive(chapterData) && !isOwnerPreview) notFound();

  // Premium / early-access: still paid while freeAt is null (permanent) or in the future.
  // Once freeAt passes, the chapter is free for everyone.
  const stillPaid =
    chapterData.isPremium && (!chapterData.freeAt || chapterData.freeAt.getTime() > Date.now());
  if (stillPaid) {
    if (!userId) {
      redirect(`/auth/signin?callbackUrl=/content/${slug}/${chapter}`);
    }
    // Fetch the unlock check + the coin balance together — the gate (shown when
    // not unlocked) needs both; one extra cheap read on the already-unlocked path.
    const [unlocked, userCoins] = await Promise.all([
      hasUnlockedChapter(userId, chapterData.id),
      getUserCoins(userId),
    ]);
    if (!unlocked) {
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

  // Count views from readers only — never the creator viewing their own work.
  const isOwner = !!userId && manga.translator?.userId === userId;

  // Side effects (view count, reading history, achievements) must NOT block the
  // reader from painting — run them after the response is sent.
  after(async () => {
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
  });

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
          chapterId={chapterData.id}
          coverUrl={manga.coverUrl ?? undefined}        />
      ) : (
        <ReaderViewer
          pages={chapterData.pages.map((p) => ({
            pageNum: p.pageNum,
            src: signedImagePath(p.id, userId),
            width: p.width,
            height: p.height,
          }))}
          chapterNum={chapterNum}
          mangaSlug={slug}
          chapterId={chapterData.id}
          mangaTitle={manga.title}
          coverUrl={manga.coverUrl ?? undefined}
          prevChapter={prevChapter?.chapterNum ?? null}
          nextChapter={nextChapter?.chapterNum ?? null}        />
      )}
      <ScrollToTop />

      <div className="max-w-4xl mx-auto px-4 pb-16">
        {/* Comments stream in separately so they never delay the reader. */}
        <Suspense fallback={<CommentsSkeleton />}>
          <ChapterComments
            chapterId={chapterData.id}
            userId={userId}
            username={session?.user?.name ?? undefined}
          />
        </Suspense>
      </div>
    </div>
  );
}

// Heavy comment query (nested replies + rank badges) split into its own streamed
// boundary so the manga/novel reader paints without waiting on it.
async function ChapterComments({
  chapterId,
  userId,
  username,
}: {
  chapterId: string;
  userId: string | null;
  username?: string;
}) {
  const comments = await prisma.comment.findMany({
    where: { chapterId, parentId: null },
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

  const rankMap = await getRankBadges([
    ...comments.map((c) => c.user.id),
    ...comments.flatMap((c) => c.replies.map((r) => r.user.id)),
    ...(userId ? [userId] : []),
  ]);
  const currentUserRank = userId ? rankMap.get(userId) ?? null : null;

  return (
    <CommentSection
      chapterId={chapterId}
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
      currentUsername={username}
      currentUserRank={currentUserRank}
    />
  );
}

function CommentsSkeleton() {
  return (
    <div className="space-y-4">
      <div className="h-5 w-32 bg-[var(--bg-surface)] rounded animate-pulse" />
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="flex gap-3">
          <div className="w-9 h-9 rounded-full bg-[var(--bg-surface)] animate-pulse shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-3 w-24 bg-[var(--bg-surface)] rounded animate-pulse" />
            <div className="h-3 w-full bg-[var(--bg-surface)] rounded animate-pulse" />
          </div>
        </div>
      ))}
    </div>
  );
}
