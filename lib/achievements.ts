import { prisma } from "./prisma";
import { createNotification } from "./notifications";

/**
 * Achievement system. Definitions live here in code (not the DB); the
 * `UserAchievement` table only records which keys a user has earned. Unlocking
 * grants a small one-time coin reward (margin-safe) and a notification — a
 * retention loop that nudges readers to read more, finish series, and engage.
 */

export type AchievementCategory = "reading" | "completion" | "social" | "engagement";

export interface AchievementDef {
  key: string;
  title: string;
  description: string;
  icon: string; // lucide icon name, mapped to a component in the UI
  category: AchievementCategory;
  metric: keyof Stats;
  threshold: number;
  coinReward: number;
}

export interface Stats {
  chaptersRead: number;
  mangaCompleted: number;
  genresRead: number;
  bookmarks: number;
  ratings: number;
  premiumUnlocked: number;
  topups: number;
  bestStreak: number;
}

export const CATEGORY_LABEL: Record<AchievementCategory, string> = {
  reading: "การอ่าน",
  completion: "อ่านจบเรื่อง",
  social: "สำรวจ & รีวิว",
  engagement: "มีส่วนร่วม",
};

export const ACHIEVEMENTS: AchievementDef[] = [
  // ── Reading volume (drives raw reading) ──
  { key: "read-1",    title: "ก้าวแรก",            description: "อ่านตอนแรกของคุณ",       icon: "BookOpen", category: "reading", metric: "chaptersRead", threshold: 1,    coinReward: 5 },
  { key: "read-10",   title: "นักอ่านหน้าใหม่",     description: "อ่านครบ 10 ตอน",         icon: "BookOpen", category: "reading", metric: "chaptersRead", threshold: 10,   coinReward: 5 },
  { key: "read-50",   title: "หนอนหนังสือ",         description: "อ่านครบ 50 ตอน",         icon: "BookText", category: "reading", metric: "chaptersRead", threshold: 50,   coinReward: 10 },
  { key: "read-100",  title: "นักอ่านตัวยง",        description: "อ่านครบ 100 ตอน",        icon: "Library",  category: "reading", metric: "chaptersRead", threshold: 100,  coinReward: 15 },
  { key: "read-500",  title: "เซียนนักอ่าน",        description: "อ่านครบ 500 ตอน",        icon: "Flame",    category: "reading", metric: "chaptersRead", threshold: 500,  coinReward: 30 },
  { key: "read-1000", title: "ตำนานนักอ่าน",        description: "อ่านครบ 1,000 ตอน",      icon: "Crown",    category: "reading", metric: "chaptersRead", threshold: 1000, coinReward: 50 },

  // ── Completion (drives finishing series) ──
  { key: "complete-1",  title: "จบเรื่องแรก",        description: "อ่านครบทุกตอน 1 เรื่อง",  icon: "CheckCircle2", category: "completion", metric: "mangaCompleted", threshold: 1,  coinReward: 10 },
  { key: "complete-5",  title: "นักสะสมเรื่องจบ",     description: "อ่านจบ 5 เรื่อง",         icon: "CheckCircle2", category: "completion", metric: "mangaCompleted", threshold: 5,  coinReward: 25 },
  { key: "complete-10", title: "ปิดเล่มมือโปร",       description: "อ่านจบ 10 เรื่อง",        icon: "Trophy",       category: "completion", metric: "mangaCompleted", threshold: 10, coinReward: 50 },

  // ── Explore & review ──
  { key: "genre-5",    title: "นักผจญภัยหลายแนว",   description: "อ่านครบ 5 แนว",          icon: "Compass",  category: "social", metric: "genresRead", threshold: 5, coinReward: 10 },
  { key: "bookmark-5", title: "ชั้นหนังสือส่วนตัว",   description: "บุ๊กมาร์ก 5 เรื่อง",       icon: "Bookmark", category: "social", metric: "bookmarks",  threshold: 5, coinReward: 5 },
  { key: "rating-1",   title: "นักวิจารณ์",          description: "ให้คะแนนเรื่องแรก",       icon: "Star",     category: "social", metric: "ratings",    threshold: 1, coinReward: 5 },

  // ── Engagement / support ──
  { key: "unlock-1",   title: "ปลดล็อกครั้งแรก",      description: "ปลดล็อกตอนพรีเมียมครั้งแรก", icon: "Unlock",       category: "engagement", metric: "premiumUnlocked", threshold: 1,  coinReward: 5 },
  { key: "unlock-25",  title: "ผู้สนับสนุนตัวจริง",    description: "ปลดล็อกครบ 25 ตอน",        icon: "Unlock",       category: "engagement", metric: "premiumUnlocked", threshold: 25, coinReward: 15 },
  { key: "topup-1",    title: "ผู้สนับสนุน",          description: "เติมเหรียญครั้งแรก",        icon: "Coins",        category: "engagement", metric: "topups",          threshold: 1,  coinReward: 10 },
  { key: "streak-7",   title: "ขยันทั้งสัปดาห์",      description: "เช็คอิน 7 วันติด",          icon: "CalendarCheck", category: "engagement", metric: "bestStreak",      threshold: 7,  coinReward: 10 },
  { key: "streak-30",  title: "วินัยเหล็ก",          description: "เช็คอิน 30 วันติด",         icon: "CalendarCheck", category: "engagement", metric: "bestStreak",      threshold: 30, coinReward: 30 },
];

/** Compute every stat an achievement can depend on, in one batch. */
async function computeStats(userId: string): Promise<Stats> {
  const [chaptersRead, bookmarks, ratings, premiumUnlocked, topups, streakAgg, reads] =
    await Promise.all([
      prisma.readHistory.count({ where: { userId } }),
      prisma.bookmark.count({ where: { userId } }),
      prisma.rating.count({ where: { userId } }),
      prisma.unlockedChapter.count({ where: { userId } }),
      prisma.coinOrder.count({ where: { userId, status: "PAID" } }),
      prisma.dailyCheckIn.aggregate({ where: { userId }, _max: { streak: true } }),
      prisma.readHistory.findMany({
        where: { userId },
        select: { chapter: { select: { mangaId: true } } },
      }),
    ]);

  // Read counts per manga → completed series + genres explored.
  const perManga = new Map<string, number>();
  for (const r of reads) {
    const mid = r.chapter.mangaId;
    perManga.set(mid, (perManga.get(mid) ?? 0) + 1);
  }
  const mangaIds = [...perManga.keys()];
  let mangaCompleted = 0;
  let genresRead = 0;
  if (mangaIds.length > 0) {
    const totals = await prisma.chapter.groupBy({
      by: ["mangaId"],
      where: { mangaId: { in: mangaIds } },
      _count: { _all: true },
    });
    const totalMap = new Map(totals.map((t) => [t.mangaId, t._count._all]));
    for (const [mid, cnt] of perManga) {
      const total = totalMap.get(mid) ?? 0;
      if (total > 0 && cnt >= total) mangaCompleted++;
    }
    const genreRows = await prisma.mangaGenre.findMany({
      where: { mangaId: { in: mangaIds } },
      select: { genreId: true },
    });
    genresRead = new Set(genreRows.map((g) => g.genreId)).size;
  }

  return {
    chaptersRead,
    mangaCompleted,
    genresRead,
    bookmarks,
    ratings,
    premiumUnlocked,
    topups,
    bestStreak: streakAgg._max.streak ?? 0,
  };
}

/**
 * Check the user's current stats against every achievement, unlock any newly
 * earned ones (atomically grant the coin reward), and notify. Idempotent: the
 * UserAchievement primary key prevents double-granting even under races.
 * Returns the achievements unlocked on THIS call.
 */
export async function evaluateAchievements(userId: string): Promise<AchievementDef[]> {
  try {
    const [stats, unlockedRows] = await Promise.all([
      computeStats(userId),
      prisma.userAchievement.findMany({ where: { userId }, select: { achievementKey: true } }),
    ]);
    const have = new Set(unlockedRows.map((r) => r.achievementKey));
    const newlyMet = ACHIEVEMENTS.filter(
      (a) => !have.has(a.key) && stats[a.metric] >= a.threshold
    );

    const unlocked: AchievementDef[] = [];
    for (const def of newlyMet) {
      try {
        // Throws P2002 if another request already inserted it (race) → skip.
        // Achievements are status/challenges only — no coin reward (avoids coin inflation).
        await prisma.userAchievement.create({
          data: { userId, achievementKey: def.key },
        });
        unlocked.push(def);
        await createNotification({
          userId,
          type: "ACHIEVEMENT",
          title: "ปลดล็อกความสำเร็จ 🏆",
          body: def.title,
          link: "/achievements",
        });
      } catch {
        // Already unlocked (race) — ignore.
      }
    }
    return unlocked;
  } catch (err) {
    console.error("[evaluateAchievements]", err);
    return [];
  }
}

const BY_KEY = new Map(ACHIEVEMENTS.map((a) => [a.key, a]));

/** A user's unlocked achievements (most recent first) — for profiles. */
export async function getUnlockedAchievements(
  userId: string,
  limit = 8
): Promise<(AchievementDef & { unlockedAt: Date })[]> {
  const rows = await prisma.userAchievement.findMany({
    where: { userId },
    orderBy: { unlockedAt: "desc" },
    take: limit,
  });
  return rows
    .map((r) => {
      const def = BY_KEY.get(r.achievementKey);
      return def ? { ...def, unlockedAt: r.unlockedAt } : null;
    })
    .filter((x): x is AchievementDef & { unlockedAt: Date } => x !== null);
}

export interface AchievementProgress extends AchievementDef {
  current: number;
  unlocked: boolean;
  unlockedAt: Date | null;
}

/** All achievements with the user's progress — for the achievements page. */
export async function getAchievementProgress(userId: string): Promise<{
  items: AchievementProgress[];
  stats: Stats;
  unlockedCount: number;
}> {
  const [stats, unlockedRows] = await Promise.all([
    computeStats(userId),
    prisma.userAchievement.findMany({ where: { userId } }),
  ]);
  const unlockedMap = new Map(unlockedRows.map((r) => [r.achievementKey, r.unlockedAt]));
  const items = ACHIEVEMENTS.map((def) => ({
    ...def,
    current: stats[def.metric],
    unlocked: unlockedMap.has(def.key),
    unlockedAt: unlockedMap.get(def.key) ?? null,
  }));
  return { items, stats, unlockedCount: unlockedMap.size };
}
