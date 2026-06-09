import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

const genres = [
  { name: "Action", slug: "action" },
  { name: "Romance", slug: "romance" },
  { name: "Fantasy", slug: "fantasy" },
  { name: "Comedy", slug: "comedy" },
  { name: "Horror", slug: "horror" },
  { name: "Slice of Life", slug: "slice-of-life" },
  { name: "Sci-Fi", slug: "sci-fi" },
  { name: "Thriller", slug: "thriller" },
  { name: "Drama", slug: "drama" },
  { name: "Adventure", slug: "adventure" },
  { name: "Supernatural", slug: "supernatural" },
  { name: "Sports", slug: "sports" },
];

const mangas = [
  {
    title: "Storm Breaker",
    slug: "storm-breaker",
    description:
      "ในโลกที่มีพลังพิเศษ นักสู้หนุ่มนามว่า ริน ออกเดินทางเพื่อกอบกู้โลกจากเหล่าปีศาจที่กำลังรุกรานมนุษยชาติ ด้วยพลังสายฟ้าในมือ เขาจะสามารถเอาชนะได้หรือไม่?",
    coverUrl: "https://picsum.photos/seed/stormbreaker/300/400",
    originCountry: "JP" as const,
    status: "ONGOING" as const,
    type: "MANGA" as const,
    totalViews: 125000,
    genres: ["action", "fantasy", "adventure"],
    chapters: [
      { chapterNum: 1, title: "จุดเริ่มต้น", viewCount: 45000 },
      { chapterNum: 2, title: "พลังที่ซ่อนเร้น", viewCount: 38000 },
      { chapterNum: 3, title: "ศัตรูตัวแรก", viewCount: 32000 },
    ],
  },
  {
    title: "Eternal Love",
    slug: "eternal-love",
    description:
      "รักที่ข้ามภพข้ามชาติ เมื่อหญิงสาวธรรมดาได้พบกับเจ้าชายผีที่ถูกสาปให้อยู่ในโลกนี้ตลอดกาล ความรักที่ไม่ควรเป็นไปได้กลับเบ่งบานขึ้น",
    coverUrl: "https://picsum.photos/seed/eternallove/300/400",
    originCountry: "KR" as const,
    status: "ONGOING" as const,
    type: "MANHWA" as const,
    totalViews: 98000,
    genres: ["romance", "supernatural", "drama"],
    chapters: [
      { chapterNum: 1, title: "การพบกันครั้งแรก", viewCount: 42000 },
      { chapterNum: 2, title: "ความลับ", viewCount: 35000 },
      { chapterNum: 3, title: "คำสัญญา", viewCount: 21000 },
    ],
  },
  {
    title: "Dragon's Lair",
    slug: "dragons-lair",
    description:
      "นักผจญภัยกลุ่มหนึ่งได้บุกเข้าไปในถ้ำมังกรโบราณ ที่นั่นพวกเขาพบกับความจริงที่ทำให้โลกทั้งใบสั่นสะเทือน เรื่องราวมหากาพย์แห่งแฟนตาซีที่รอให้คุณค้นพบ",
    coverUrl: "https://picsum.photos/seed/dragonslair/300/400",
    originCountry: "CN" as const,
    status: "COMPLETED" as const,
    type: "MANHUA" as const,
    totalViews: 87500,
    genres: ["fantasy", "adventure", "action"],
    chapters: [
      { chapterNum: 1, title: "ถ้ำต้องห้าม", viewCount: 28000 },
      { chapterNum: 2, title: "มังกรตื่น", viewCount: 22000 },
      { chapterNum: 3, title: "ตำนานโบราณ", viewCount: 18000 },
    ],
  },
  {
    title: "Shadow Academy",
    slug: "shadow-academy",
    description:
      "โรงเรียนลับที่ฝึกสายลับรุ่นใหม่ เด็กนักเรียนธรรมดาคนหนึ่งถูกเชิญเข้าสู่โรงเรียนที่ไม่มีใครรู้จัก ที่นั่นเขาจะได้เรียนรู้ว่าโลกนี้ซ่อนความจริงอะไรไว้",
    coverUrl: "https://picsum.photos/seed/shadowacademy/300/400",
    originCountry: "KR" as const,
    status: "ONGOING" as const,
    type: "MANHWA" as const,
    totalViews: 76000,
    genres: ["action", "thriller", "supernatural"],
    chapters: [
      { chapterNum: 1, title: "จดหมายลึกลับ", viewCount: 31000 },
      { chapterNum: 2, title: "การทดสอบ", viewCount: 25000 },
      { chapterNum: 3, title: "เพื่อนร่วมรุ่น", viewCount: 20000 },
    ],
  },
  {
    title: "Café Sakura",
    slug: "cafe-sakura",
    description:
      "ร้านกาแฟเล็กๆ ใต้ต้นซากุระ ที่ที่รักเบ่งบานและความทรงจำหวานขมถูกสร้างขึ้น เรื่องราวชีวิตประจำวันที่อบอุ่นหัวใจ",
    coverUrl: "https://picsum.photos/seed/cafesakura/300/400",
    originCountry: "JP" as const,
    status: "ONGOING" as const,
    type: "MANGA" as const,
    totalViews: 65000,
    genres: ["romance", "slice-of-life", "comedy"],
    chapters: [
      { chapterNum: 1, title: "วันแรก", viewCount: 27000 },
      { chapterNum: 2, title: "ลูกค้าพิเศษ", viewCount: 22000 },
      { chapterNum: 3, title: "ฝนและกาแฟ", viewCount: 16000 },
    ],
  },
  {
    title: "Cyber Punk Zero",
    slug: "cyber-punk-zero",
    description:
      "โลกปี 2087 เมื่อเทคโนโลยีก้าวหน้าเกินควบคุม มนุษย์คนสุดท้ายที่ไม่มีชิปในสมองออกล่าองค์กรที่ต้องการครองโลก",
    coverUrl: "https://picsum.photos/seed/cyberpunk/300/400",
    originCountry: "JP" as const,
    status: "ONGOING" as const,
    type: "MANGA" as const,
    totalViews: 54000,
    genres: ["sci-fi", "action", "thriller"],
    chapters: [
      { chapterNum: 1, title: "โลกใหม่", viewCount: 22000 },
      { chapterNum: 2, title: "ล่า", viewCount: 18000 },
      { chapterNum: 3, title: "ซ่อน", viewCount: 14000 },
    ],
  },
  {
    title: "Spirit Hunter",
    slug: "spirit-hunter",
    description:
      "นักล่าวิญญาณสาวที่มีพลังพิเศษต่อสู้กับวิญญาณชั่วร้ายที่หลบซ่อนอยู่ในเมืองใหญ่ แต่ความจริงที่เธอไม่รู้คือเธอเองก็คือหนึ่งในนั้น",
    coverUrl: "https://picsum.photos/seed/spirithunter/300/400",
    originCountry: "CN" as const,
    status: "HIATUS" as const,
    type: "MANHUA" as const,
    totalViews: 43000,
    genres: ["horror", "supernatural", "action"],
    chapters: [
      { chapterNum: 1, title: "คืนแรก", viewCount: 18000 },
      { chapterNum: 2, title: "สัญญาณ", viewCount: 14000 },
      { chapterNum: 3, title: "ความจริงครึ่งเดียว", viewCount: 11000 },
    ],
  },
  {
    title: "King of the Court",
    slug: "king-of-the-court",
    description:
      "ทีมบาสเก็ตบอลที่เกือบจะล้มเลิก ได้รับการช่วยเหลือจากนักกีฬาหนุ่มที่เคยเลิกเล่นไปแล้ว เรื่องราวแห่งการฟื้นฟูและมิตรภาพ",
    coverUrl: "https://picsum.photos/seed/kingcourt/300/400",
    originCountry: "JP" as const,
    status: "ONGOING" as const,
    type: "MANGA" as const,
    totalViews: 38000,
    genres: ["sports", "drama", "comedy"],
    chapters: [
      { chapterNum: 1, title: "ทีมที่แตกสลาย", viewCount: 16000 },
      { chapterNum: 2, title: "ผู้มาใหม่", viewCount: 13000 },
      { chapterNum: 3, title: "ทดสอบฝีมือ", viewCount: 9000 },
    ],
  },
  {
    title: "The Last Alchemist",
    slug: "the-last-alchemist",
    description:
      "เมื่อวิชาเล่นแร่แปรธาตุถูกห้ามทั่วโลก นักเล่นแร่แปรธาตุคนสุดท้ายต้องซ่อนตัวและค้นหาความจริงเบื้องหลังกฎหมายลึกลับนี้",
    coverUrl: "https://picsum.photos/seed/alchemist/300/400",
    originCountry: "KR" as const,
    status: "COMPLETED" as const,
    type: "MANHWA" as const,
    totalViews: 29000,
    genres: ["fantasy", "adventure", "drama"],
    chapters: [
      { chapterNum: 1, title: "วันสุดท้าย", viewCount: 12000 },
      { chapterNum: 2, title: "หลบหนี", viewCount: 9500 },
      { chapterNum: 3, title: "พันธมิตร", viewCount: 7500 },
    ],
  },
  {
    title: "Neon Street",
    slug: "neon-street",
    description:
      "ชีวิตในตรอกนีออนของเมืองแห่งอนาคต เรื่องราวของศิลปินข้างถนน แก๊งค์ และความฝันที่ยังไม่ดับสูญ",
    coverUrl: "https://picsum.photos/seed/neonstreet/300/400",
    originCountry: "TH" as const,
    status: "ONGOING" as const,
    type: "MANGA" as const,
    totalViews: 18500,
    genres: ["drama", "slice-of-life", "sci-fi"],
    chapters: [
      { chapterNum: 1, title: "ตรอกนีออน", viewCount: 8000 },
      { chapterNum: 2, title: "ภาพแรก", viewCount: 6000 },
      { chapterNum: 3, title: "คืนพายุ", viewCount: 4500 },
    ],
  },
];

const coinPackages = [
  { name: "Starter", coins: 100, price: 29, bonus: 0,   isPopular: false },
  { name: "Value",   coins: 300, price: 79, bonus: 20,  isPopular: false },
  { name: "Popular", coins: 600, price: 149, bonus: 60, isPopular: true  },
  { name: "Mega",    coins: 1200, price: 249, bonus: 150, isPopular: false },
];

async function main() {
  console.log("🌱 Seeding database...");

  // Coin packages
  console.log("Creating coin packages...");
  for (const pkg of coinPackages) {
    await prisma.coinPackage.upsert({
      where: { id: pkg.name.toLowerCase() },
      create: { id: pkg.name.toLowerCase(), ...pkg, isActive: true },
      update: pkg,
    });
  }

  // Create genres
  console.log("Creating genres...");
  const genreMap: Record<string, string> = {};
  for (const genre of genres) {
    const g = await prisma.genre.upsert({
      where: { slug: genre.slug },
      create: genre,
      update: {},
    });
    genreMap[genre.slug] = g.id;
  }

  // Create admin user
  console.log("Creating admin user...");
  const adminHash = await bcrypt.hash("admin1234", 12);
  await prisma.user.upsert({
    where: { email: "admin@inkverse.io" },
    create: {
      username: "inkverse_admin",
      email: "admin@inkverse.io",
      passwordHash: adminHash,
      role: "ADMIN",
    },
    update: {},
  });

  // Create translator user
  const translatorHash = await bcrypt.hash("trans1234", 12);
  const translator = await prisma.user.upsert({
    where: { email: "translator@inkverse.io" },
    create: {
      username: "manga_trans",
      email: "translator@inkverse.io",
      passwordHash: translatorHash,
      role: "TRANSLATOR",
    },
    update: {},
  });

  await prisma.translator.upsert({
    where: { userId: translator.id },
    create: {
      userId: translator.id,
      penName: "MangaTrans Studio",
      bio: "ทีมแปลมังงะคุณภาพสูง",
      totalWorks: mangas.length,
    },
    update: {},
  });

  // Create mangas
  console.log("Creating 10 sample manga...");
  for (const manga of mangas) {
    const { genres: mangaGenres, chapters, ...mangaData } = manga;

    const created = await prisma.manga.upsert({
      where: { slug: manga.slug },
      create: {
        ...mangaData,
        genres: {
          create: mangaGenres
            .filter((s) => genreMap[s])
            .map((s) => ({ genreId: genreMap[s] })),
        },
      },
      update: { totalViews: mangaData.totalViews },
    });

    // Create chapters with placeholder pages
    for (const chapter of chapters) {
      const existingChapter = await prisma.chapter.findUnique({
        where: { mangaId_chapterNum: { mangaId: created.id, chapterNum: chapter.chapterNum } },
      });

      if (!existingChapter) {
        const ch = await prisma.chapter.create({
          data: {
            mangaId: created.id,
            chapterNum: chapter.chapterNum,
            title: chapter.title,
            viewCount: chapter.viewCount,
            isPremium: false,
          },
        });

        // Add placeholder pages (8 per chapter)
        const pageData = Array.from({ length: 8 }, (_, i) => ({
          chapterId: ch.id,
          pageNum: i + 1,
          imageUrl: `https://picsum.photos/seed/${manga.slug}-ch${chapter.chapterNum}-p${i + 1}/800/1200`,
          width: 800,
          height: 1200,
        }));

        await prisma.page.createMany({ data: pageData });
      }
    }

    // Create weekly stats
    await prisma.weeklyStats.upsert({
      where: { mangaId_period: { mangaId: created.id, period: "WEEK" } },
      create: {
        mangaId: created.id,
        period: "WEEK",
        views: Math.floor(mangaData.totalViews * 0.1),
        bookmarks: Math.floor(Math.random() * 500),
        likes: Math.floor(Math.random() * 300),
        rank: mangas.indexOf(manga) + 1,
      },
      update: {},
    });

    await prisma.weeklyStats.upsert({
      where: { mangaId_period: { mangaId: created.id, period: "MONTH" } },
      create: {
        mangaId: created.id,
        period: "MONTH",
        views: Math.floor(mangaData.totalViews * 0.4),
        bookmarks: Math.floor(Math.random() * 2000),
        likes: Math.floor(Math.random() * 1200),
        rank: mangas.indexOf(manga) + 1,
      },
      update: {},
    });

    await prisma.weeklyStats.upsert({
      where: { mangaId_period: { mangaId: created.id, period: "ALL" } },
      create: {
        mangaId: created.id,
        period: "ALL",
        views: mangaData.totalViews,
        bookmarks: Math.floor(Math.random() * 8000),
        likes: Math.floor(Math.random() * 5000),
        rank: mangas.indexOf(manga) + 1,
      },
      update: {},
    });

    console.log(`  ✓ ${manga.title}`);
  }

  console.log("\n✅ Seed complete!");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("Admin:      admin@inkverse.io / admin1234");
  console.log("Translator: translator@inkverse.io / trans1234");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
