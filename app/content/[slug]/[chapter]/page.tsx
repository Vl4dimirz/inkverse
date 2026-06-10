import { prisma } from "@/lib/prisma";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import ReaderViewer from "@/components/ui/ReaderViewer";
import ScrollToTop from "@/components/ui/ScrollToTop";
import CommentSection from "@/components/ui/CommentSection";
import PremiumGate from "@/components/ui/PremiumGate";
import { getUserCoins, hasUnlockedChapter } from "@/lib/coins";
import type { Metadata } from "next";

const BASE_URL = process.env.SITE_URL || process.env.NEXTAUTH_URL || "https://inkverse.com";

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
    select: { id: true, title: true, slug: true },
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

  if (chapterData.isPremium) {
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
        />
      );
    }
  }
  // ─────────────────────────────────────────────────────────────

  // Adjacent chapters
  const [prevChapter, nextChapter] = await Promise.all([
    prisma.chapter.findFirst({
      where: { mangaId: manga.id, chapterNum: { lt: chapterNum } },
      orderBy: { chapterNum: "desc" },
      select: { chapterNum: true },
    }),
    prisma.chapter.findFirst({
      where: { mangaId: manga.id, chapterNum: { gt: chapterNum } },
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
      user: { select: { username: true, avatarUrl: true } },
      replies: {
        include: { user: { select: { username: true, avatarUrl: true } } },
        orderBy: { createdAt: "asc" },
        take: 10,
      },
    },
  });

  // Increment chapter views + save history
  await prisma.chapter.update({
    where: { id: chapterData.id },
    data: { viewCount: { increment: 1 } },
  });

  if (userId) {
    await prisma.readHistory.upsert({
      where: { userId_chapterId: { userId, chapterId: chapterData.id } },
      create: { userId, chapterId: chapterData.id, lastPage: 1 },
      update: { readAt: new Date() },
    });
  }

  return (
    <div>
      <ReaderViewer
        pages={chapterData.pages.map((p) => ({
          pageNum: p.pageNum,
          imageUrl: p.imageUrl,
          width: p.width,
          height: p.height,
        }))}
        chapterNum={chapterNum}
        mangaSlug={slug}
        prevChapter={prevChapter?.chapterNum ?? null}
        nextChapter={nextChapter?.chapterNum ?? null}
      />
      <ScrollToTop />

      <div className="max-w-4xl mx-auto px-4 pb-16">
        <CommentSection
          chapterId={chapterData.id}
          comments={comments.map((c) => ({
            ...c,
            createdAt: c.createdAt.toISOString(),
            replies: c.replies.map((r) => ({
              ...r,
              createdAt: r.createdAt.toISOString(),
              replies: [],
            })),
          }))}
          currentUserId={userId ?? undefined}
          currentUsername={session?.user?.name ?? undefined}
        />
      </div>
    </div>
  );
}
