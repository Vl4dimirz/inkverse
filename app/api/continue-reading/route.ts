import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Per-user "continue reading": the most recent chapter read per manga.
export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ items: [] });

  const userId = (session.user as { id: string }).id;
  const history = await prisma.readHistory.findMany({
    where: { userId },
    orderBy: { readAt: "desc" },
    take: 50,
    include: {
      chapter: {
        select: {
          chapterNum: true,
          mangaId: true,
          manga: { select: { slug: true, title: true, coverUrl: true } },
        },
      },
    },
  });

  const seen = new Set<string>();
  const items: { slug: string; title: string; coverUrl: string | null; chapterNum: number }[] = [];
  for (const h of history) {
    const mid = h.chapter.mangaId;
    if (seen.has(mid)) continue;
    seen.add(mid);
    items.push({
      slug: h.chapter.manga.slug,
      title: h.chapter.manga.title,
      coverUrl: h.chapter.manga.coverUrl,
      chapterNum: h.chapter.chapterNum,
    });
    if (items.length >= 12) break;
  }

  return NextResponse.json({ items });
}
