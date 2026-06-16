// Backfill the denormalized Manga aggregates (avgRating, ratingCount,
// bookmarkCount, latestChapterNum). Idempotent — recomputes from source, safe to
// re-run. Run AFTER `npx prisma db push` adds the columns:
//   node scripts/backfill-manga-stats.cjs
require("dotenv").config();
const { PrismaClient } = require("@prisma/client");
const { PrismaPg } = require("@prisma/adapter-pg");
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

function liveChapterWhere() {
  return { status: { not: "DRAFT" }, OR: [{ publishAt: null }, { publishAt: { lte: new Date() } }] };
}

(async () => {
  const mangas = await prisma.manga.findMany({ select: { id: true } });
  let n = 0;
  for (const m of mangas) {
    const [r, bm, ch] = await Promise.all([
      prisma.rating.aggregate({ where: { mangaId: m.id }, _avg: { score: true }, _count: true }),
      prisma.bookmark.count({ where: { mangaId: m.id } }),
      prisma.chapter.findFirst({ where: { mangaId: m.id, ...liveChapterWhere() }, orderBy: { chapterNum: "desc" }, select: { chapterNum: true } }),
    ]);
    await prisma.manga.update({
      where: { id: m.id },
      data: {
        avgRating: r._avg.score ?? 0,
        ratingCount: r._count,
        bookmarkCount: bm,
        latestChapterNum: ch?.chapterNum ?? null,
      },
    });
    n++;
  }
  console.log(`✅ backfilled ${n} mangas`);
  await prisma.$disconnect();
})();
