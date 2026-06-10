import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { ArrowLeft, LayoutGrid } from "lucide-react";
import PageReorderClient from "./PageReorderClient";
import type { Metadata } from "next";

interface Props {
  params: Promise<{ id: string }>;
}

export const metadata: Metadata = { title: "จัดเรียงหน้า | Inkverse" };

export default async function PageReorderPage({ params }: Props) {
  const session = await auth();
  const role = (session?.user as { role?: string })?.role;
  if (!session?.user) redirect("/auth/signin");
  if (role !== "TRANSLATOR" && role !== "ADMIN") redirect("/");

  const { id } = await params;
  const userId = (session.user as { id: string }).id;

  const chapter = await prisma.chapter.findUnique({
    where: { id },
    include: {
      pages: { orderBy: { pageNum: "asc" } },
      manga: {
        select: {
          title: true, slug: true,
          translator: { select: { userId: true } },
        },
      },
    },
  });

  if (!chapter) notFound();

  // Ownership check
  if (role !== "ADMIN" && chapter.manga.translator?.userId !== userId) {
    redirect("/dashboard");
  }

  const pages = chapter.pages.map((p) => ({
    id: p.id,
    pageNum: p.pageNum,
    imageUrl: p.imageUrl,
    width: p.width,
    height: p.height,
  }));

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-4">
      {/* Header */}
      <div>
        <Link
          href={`/dashboard/manga/${chapter.manga.slug}/chapters`}
          className="inline-flex items-center gap-1.5 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] mb-3 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> จัดการตอน
        </Link>
        <div className="flex items-start gap-3">
          <LayoutGrid className="w-6 h-6 text-[var(--text-primary)] mt-0.5 shrink-0" />
          <div>
            <p className="text-xs text-[var(--text-secondary)] mb-0.5">{chapter.manga.title}</p>
            <h1 className="font-bebas text-3xl text-[var(--text-primary)] tracking-wider leading-none">
              จัดเรียงหน้า — ตอนที่ {chapter.chapterNum}
              {chapter.title && <span className="text-[var(--text-secondary)] text-xl ml-2">{chapter.title}</span>}
            </h1>
          </div>
        </div>
      </div>

      <PageReorderClient
        chapterId={id}
        chapterNum={chapter.chapterNum}
        mangaSlug={chapter.manga.slug}
        initialPages={pages}
      />
    </div>
  );
}
