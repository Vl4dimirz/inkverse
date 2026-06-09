import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { ArrowLeft, BookOpen } from "lucide-react";
import ChapterManager from "./ChapterManager";
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

  const chapters = manga.chapters.map((ch) => ({
    id: ch.id,
    chapterNum: ch.chapterNum,
    title: ch.title,
    isPremium: ch.isPremium,
    coinCost: ch.coinCost,
    viewCount: ch.viewCount,
    pageCount: ch._count.pages,
    publishedAt: ch.publishedAt.toISOString(),
  }));

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      <div>
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-white mb-3 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Dashboard
        </Link>
        <div className="flex items-start gap-3">
          <BookOpen className="w-6 h-6 text-[#ff6b2b] mt-1 shrink-0" />
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-widest mb-0.5">จัดการตอน</p>
            <h1 className="font-bebas text-3xl text-white tracking-wider leading-none">
              {manga.title}
            </h1>
          </div>
        </div>
      </div>

      <ChapterManager
        mangaTitle={manga.title}
        mangaSlug={slug}
        initialChapters={chapters}
      />
    </div>
  );
}
