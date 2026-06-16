import { prisma } from "@/lib/prisma";
import { liveChapterWhere } from "@/lib/chapters";

/**
 * Keep the denormalized Manga aggregates (avgRating, ratingCount, bookmarkCount,
 * latestChapterNum) in sync. Call after the relevant mutation. Best-effort: a
 * sync failure is swallowed so it never breaks the user's action — the values
 * are display-only and can be re-derived by the backfill script.
 *
 * NOTE on latestChapterNum: it's recomputed against `liveChapterWhere()` at call
 * time. A chapter scheduled for the future is (correctly) not counted yet; when
 * it goes live there's no cron, so the card's latest number refreshes on the next
 * chapter mutation (or a backfill run). Fine for the common publish-now case.
 */
export async function syncMangaRating(mangaId: string): Promise<void> {
  try {
    const agg = await prisma.rating.aggregate({ where: { mangaId }, _avg: { score: true }, _count: true });
    await prisma.manga.update({
      where: { id: mangaId },
      data: { avgRating: agg._avg.score ?? 0, ratingCount: agg._count },
    });
  } catch {}
}

export async function syncMangaBookmarks(mangaId: string): Promise<void> {
  try {
    const count = await prisma.bookmark.count({ where: { mangaId } });
    await prisma.manga.update({ where: { id: mangaId }, data: { bookmarkCount: count } });
  } catch {}
}

export async function syncMangaLatestChapter(mangaId: string): Promise<void> {
  try {
    const latest = await prisma.chapter.findFirst({
      where: { mangaId, ...liveChapterWhere() },
      orderBy: { chapterNum: "desc" },
      select: { chapterNum: true },
    });
    await prisma.manga.update({ where: { id: mangaId }, data: { latestChapterNum: latest?.chapterNum ?? null } });
  } catch {}
}
