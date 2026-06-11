import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { ArrowLeft, BookOpen, Plus } from "lucide-react";
import ChapterManager from "./ChapterManager";
import MangaSettings from "./MangaSettings";
import { novelStats } from "@/lib/markdown";
import { Pencil } from "lucide-react";
import type { Metadata } from "next";

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const manga = await prisma.manga.findUnique({ where: { slug }, select: { title: true } });
  return { title: manga ? `จัดการตอน — ${manga.title}` : "จัดการตอน" };
}

export default async function MangaChaptersPage({ params }: Props) {
  const session = await auth();
  const role = (session?.user as { role?: string })?.role;
  if (!session?.user) redirect("/auth/signin");
  if (role !== "TRANSLATOR" && role !== "ADMIN") redirect("/");

  const { slug } = await params;
  const userId = (session.user as { id: string }).id;

  const manga = await prisma.manga.findUnique({
    where: { slug },
    include: {
      chapters: {
        orderBy: { chapterNum: "asc" },
        include: { _count: { select: { pages: true } } },
      },
      translator: { select: { userId: true } },
    },
  });

  if (!manga) notFound();

  // Ownership check (admin bypasses)
  if (role !== "ADMIN" && manga.translator?.userId !== userId) {
    redirect("/dashboard");
  }

  const isNovel = manga.type === "NOVEL";
  const chapters = manga.chapters.map((ch) => ({
    id: ch.id,
    chapterNum: ch.chapterNum,
    title: ch.title,
    isPremium: ch.isPremium,
    coinCost: ch.coinCost,
    viewCount: ch.viewCount,
    pageCount: ch._count.pages,
    wordCount: isNovel ? novelStats(ch.content).words : 0,
    status: ch.status,
    scheduledAt: ch.publishAt ? ch.publishAt.toISOString() : null,
    publishedAt: ch.publishedAt.toISOString(),
  }));

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      <div>
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] mb-3 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Dashboard
        </Link>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <BookOpen className="w-6 h-6 text-[var(--text-primary)] mt-1 shrink-0" />
            <div>
              <p className="text-xs text-[var(--text-secondary)] uppercase tracking-widest mb-0.5">จัดการตอน</p>
              <h1 className="font-bebas text-3xl text-[var(--text-primary)] tracking-wider leading-none">
                {manga.title}
              </h1>
            </div>
          </div>
          {isNovel ? (
            <Link
              href={`/dashboard/manga/${slug}/write`}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bal-btn text-sm font-semibold hover:opacity-90 transition-colors shrink-0"
            >
              <Pencil className="w-4 h-4" /> เขียนตอนใหม่
            </Link>
          ) : (
            <Link
              href={`/upload?manga=${slug}`}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bal-btn text-sm font-semibold hover:opacity-90 transition-colors shrink-0"
            >
              <Plus className="w-4 h-4" /> อัปโหลดตอนเพิ่ม
            </Link>
          )}
        </div>
      </div>

      <MangaSettings
        slug={slug}
        manga={{
          title: manga.title,
          description: manga.description,
          status: manga.status,
          type: manga.type,
          contentRating: manga.contentRating,
          coverUrl: manga.coverUrl ?? null,
        }}
      />

      <ChapterManager
        mangaTitle={manga.title}
        mangaSlug={slug}
        mangaType={manga.type}
        initialChapters={chapters}
      />
    </div>
  );
}
