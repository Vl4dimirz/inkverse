import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isChapterLive, liveChapterWhere } from "@/lib/chapters";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string; chapter: string }> }
) {
  const { slug, chapter } = await params;
  const chapterNum = parseFloat(chapter);

  const manga = await prisma.manga.findUnique({
    where: { slug },
    select: { id: true },
  });

  if (!manga) {
    return NextResponse.json({ error: "Manga not found" }, { status: 404 });
  }

  const chapterData = await prisma.chapter.findUnique({
    where: { mangaId_chapterNum: { mangaId: manga.id, chapterNum } },
    include: { pages: { orderBy: { pageNum: "asc" } } },
  });

  if (!chapterData || !isChapterLive(chapterData)) {
    return NextResponse.json({ error: "Chapter not found" }, { status: 404 });
  }

  const [prev, next] = await Promise.all([
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

  return NextResponse.json({
    ...chapterData,
    prevChapter: prev?.chapterNum ?? null,
    nextChapter: next?.chapterNum ?? null,
  });
}
