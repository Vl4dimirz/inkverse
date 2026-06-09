/**
 * Fetches 50 popular manga from AniList public API and seeds the database.
 * Metadata (titles, descriptions, cover art) is promotional data provided
 * by AniList. Chapter pages use placeholders — actual manga pages require
 * a content license.
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

const ANILIST_API = "https://graphql.anilist.co";
const TOTAL_TARGET = 50;
const CHAPTERS_PER_MANGA = 10;
const FREE_CHAPTERS = 7; // chapters 1-7 free, 8-10 costs 2 coins
const PAGES_PER_CHAPTER = 20;
const PREMIUM_COIN_COST = 2;

interface AniListManga {
  id: number;
  title: { romaji: string; english: string | null; native: string };
  description: string | null;
  coverImage: { extraLarge: string; large: string };
  bannerImage: string | null;
  genres: string[];
  status: string;
  countryOfOrigin: string;
  chapters: number | null;
  averageScore: number | null;
  popularity: number;
  format: string;
}

const QUERY = `
query($page: Int!, $perPage: Int!) {
  Page(page: $page, perPage: $perPage) {
    pageInfo { hasNextPage currentPage }
    media(
      type: MANGA
      sort: POPULARITY_DESC
      isAdult: false
      format_not_in: [NOVEL, ONE_SHOT]
    ) {
      id
      title { romaji english native }
      description(asHtml: false)
      coverImage { extraLarge large }
      bannerImage
      genres
      status
      countryOfOrigin
      chapters
      averageScore
      popularity
      format
    }
  }
}
`;

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .trim()
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function mapStatus(s: string): string {
  return (
    { FINISHED: "COMPLETED", RELEASING: "ONGOING", HIATUS: "HIATUS", CANCELLED: "COMPLETED" }[s] ??
    "ONGOING"
  );
}

function mapType(country: string, format: string): string {
  if (format === "MANHWA" || country === "KR") return "MANHWA";
  if (format === "MANHUA" || country === "CN" || country === "TW") return "MANHUA";
  return "MANGA";
}

function cleanDescription(raw: string | null): string {
  if (!raw) return "ไม่มีคำอธิบาย";
  return raw
    .replace(/<[^>]*>/g, "")
    .replace(/&[a-z]+;/g, (e) =>
      ({ "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#039;": "'" }[e] ?? e)
    )
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, 2000);
}

async function fetchPage(page: number, perPage: number): Promise<AniListManga[]> {
  const res = await fetch(ANILIST_API, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ query: QUERY, variables: { page, perPage } }),
  });
  if (!res.ok) throw new Error(`AniList API error: ${res.status}`);
  const json = await res.json() as { errors?: { message: string }[]; data: { Page: { media: AniListManga[] } } };
  if (json.errors) throw new Error(json.errors[0].message);
  return json.data.Page.media;
}

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  console.log("Fetching manga from AniList API...\n");

  // Fetch 50 from page 1 (AniList max per page = 50)
  const rawManga = await fetchPage(1, 50);
  console.log(`Fetched ${rawManga.length} titles from AniList`);

  // Collect all genres and upsert
  const allGenreNames = [...new Set(rawManga.flatMap((m) => m.genres))].filter(Boolean);
  console.log(`Upserting ${allGenreNames.length} genres...`);
  const genreMap: Record<string, string> = {};
  for (const name of allGenreNames) {
    const slug = slugify(name);
    if (!slug) continue;
    const g = await prisma.genre.upsert({
      where: { slug },
      create: { name, slug },
      update: {},
    });
    genreMap[name] = g.id;
  }

  let created = 0;
  let skipped = 0;

  for (const m of rawManga.slice(0, TOTAL_TARGET)) {
    const displayTitle = m.title.english || m.title.romaji;
    if (!displayTitle) { skipped++; continue; }

    let slug = slugify(m.title.romaji || m.title.english || `manga-${m.id}`);
    if (!slug) slug = `manga-${m.id}`;

    // Skip if slug already exists
    const existing = await prisma.manga.findUnique({ where: { slug } });
    if (existing) {
      // Try appending anilist id to make unique
      const altSlug = `${slug}-${m.id}`;
      const existingAlt = await prisma.manga.findUnique({ where: { slug: altSlug } });
      if (existingAlt) { skipped++; continue; }
      slug = altSlug;
    }

    const coverUrl = m.coverImage.extraLarge || m.coverImage.large;
    const description = cleanDescription(m.description);
    const type = mapType(m.countryOfOrigin, m.format);
    const status = mapStatus(m.status);
    const originCountry = m.countryOfOrigin || "JP";
    // Estimate views from popularity score
    const totalViews = m.popularity * 50;

    const validGenreIds = m.genres
      .filter((g) => genreMap[g])
      .map((g) => ({ genreId: genreMap[g] }));

    const manga = await prisma.manga.create({
      data: {
        title: displayTitle,
        slug,
        description,
        coverUrl,
        originCountry,
        status,
        type,
        totalViews,
        genres: { create: validGenreIds },
      },
    });

    // Create chapters
    for (let i = 1; i <= CHAPTERS_PER_MANGA; i++) {
      const isPremium = i > FREE_CHAPTERS;
      const daysAgo = (CHAPTERS_PER_MANGA - i) * 7; // 1 chapter/week
      const ch = await prisma.chapter.create({
        data: {
          mangaId: manga.id,
          chapterNum: i,
          title: `ตอนที่ ${i}`,
          isPremium,
          coinCost: isPremium ? PREMIUM_COIN_COST : 0,
          viewCount: Math.max(0, Math.floor(totalViews / CHAPTERS_PER_MANGA - i * 1000)),
          publishedAt: new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000),
        },
      });

      // Placeholder pages (picsum gives random images per seed)
      await prisma.page.createMany({
        data: Array.from({ length: PAGES_PER_CHAPTER }, (_, p) => ({
          chapterId: ch.id,
          pageNum: p + 1,
          imageUrl: `https://picsum.photos/seed/${slug}-c${i}-p${p + 1}/800/1200`,
          width: 800,
          height: 1200,
        })),
      });
    }

    // Weekly stats
    const statBase = m.popularity;
    for (const [period, mult] of [["WEEK", 0.02], ["MONTH", 0.1], ["ALL", 1]] as const) {
      await prisma.weeklyStats.upsert({
        where: { mangaId_period: { mangaId: manga.id, period } },
        create: {
          mangaId: manga.id,
          period,
          views: Math.floor(statBase * mult * 50),
          bookmarks: Math.floor(statBase * mult * 0.3),
          likes: Math.floor(statBase * mult * 0.2),
          rank: created + 1,
        },
        update: {},
      });
    }

    created++;
    const lock = isPremiumNote(CHAPTERS_PER_MANGA - FREE_CHAPTERS);
    process.stdout.write(
      `  [${String(created).padStart(2, "0")}/${TOTAL_TARGET}] ${displayTitle.slice(0, 45).padEnd(45)} ${lock}\n`
    );

    // AniList rate limit: 90 req/min — small delay between iterations
    await sleep(120);
  }

  console.log(`\nDone — created: ${created}, skipped: ${skipped}`);
  console.log(`Each manga: ${FREE_CHAPTERS} free + ${CHAPTERS_PER_MANGA - FREE_CHAPTERS} locked (${PREMIUM_COIN_COST} coins each)`);
}

function isPremiumNote(count: number) {
  return `[lock: last ${count} chapters @ ${PREMIUM_COIN_COST} coins]`;
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
