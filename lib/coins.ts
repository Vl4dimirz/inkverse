import { prisma } from "./prisma";
import type { Prisma } from "@prisma/client";

// Reader gets this many coins the moment their account is created (both Google
// OAuth and email/password). Granted once per user — see grantSignupBonus.
export const SIGNUP_BONUS_COINS = 20;

// Tiered discount for unlocking many chapters at once — encourages spending the
// whole balance in one go (raises coins-used). Kept in sync with the UI hint in
// components/ui/BulkUnlock.tsx.
export function bulkDiscountRate(count: number): number {
  if (count >= 50) return 0.15;
  if (count >= 20) return 0.10;
  if (count >= 10) return 0.05;
  return 0;
}

// VIP perks (30-day pass, no auto-renew): a monthly coin stipend + this discount
// on every unlock. Discounts are always margin-safe — they reduce the reader's
// charge and the translator's 80% share proportionally; platform keeps 20%.
export const VIP_UNLOCK_DISCOUNT = 0.10;
export const VIP_DEFAULT_DAYS = 30;

export function isVipActive(vipExpiresAt: Date | null | undefined): boolean {
  return !!vipExpiresAt && vipExpiresAt.getTime() > Date.now();
}

// Extend a user's VIP window by `days`, stacking onto any remaining time.
// Call inside the same transaction that credits the purchase.
export async function extendVipDays(
  tx: Prisma.TransactionClient,
  userId: string,
  days: number
): Promise<void> {
  const u = await tx.user.findUnique({
    where: { id: userId },
    select: { vipExpiresAt: true },
  });
  const base =
    u?.vipExpiresAt && u.vipExpiresAt.getTime() > Date.now()
      ? u.vipExpiresAt.getTime()
      : Date.now();
  const expires = new Date(base + days * 24 * 60 * 60 * 1000);
  await tx.user.update({ where: { id: userId }, data: { vipExpiresAt: expires } });
}

export async function getUserCoins(userId: string): Promise<number> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { coins: true },
  });
  return user?.coins ?? 0;
}

export async function hasUnlockedChapter(
  userId: string,
  chapterId: string
): Promise<boolean> {
  const unlock = await prisma.unlockedChapter.findUnique({
    where: { userId_chapterId: { userId, chapterId } },
  });
  return !!unlock;
}

export type UnlockResult =
  | { success: true; coinsLeft: number }
  | { success: false; error: "NOT_PREMIUM" | "ALREADY_UNLOCKED" | "INSUFFICIENT_COINS" | "NOT_FOUND" };

const TRANSLATOR_SHARE = 0.80; // 80% to translator, 20% platform fee

export async function unlockChapter(
  userId: string,
  chapterId: string
): Promise<UnlockResult> {
  const chapter = await prisma.chapter.findUnique({
    where: { id: chapterId },
    select: {
      isPremium: true, coinCost: true, mangaId: true, chapterNum: true,
      manga: { select: { translatorId: true } },
    },
  });

  if (!chapter) return { success: false, error: "NOT_FOUND" };
  if (!chapter.isPremium) return { success: false, error: "NOT_PREMIUM" };

  const alreadyUnlocked = await hasUnlockedChapter(userId, chapterId);
  if (alreadyUnlocked) return { success: false, error: "ALREADY_UNLOCKED" };

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { coins: true, vipExpiresAt: true },
  });
  // VIP readers get a discount on the coin cost.
  const vipRate = isVipActive(user?.vipExpiresAt) ? VIP_UNLOCK_DISCOUNT : 0;
  const cost = Math.round(chapter.coinCost * (1 - vipRate));
  if (!user || user.coins < cost) {
    return { success: false, error: "INSUFFICIENT_COINS" };
  }

  const translatorId = chapter.manga?.translatorId ?? null;
  const earningAmount = parseFloat((cost * TRANSLATOR_SHARE).toFixed(2));

  const updatedUser = await prisma.$transaction(async (tx) => {
    // Conditional decrement guards against double-spend / negative balance when
    // two unlocks (of different chapters) race — the pre-check above is outside
    // the tx, so without this guard both could pass and drive coins negative.
    // Mirrors unlockChaptersBulk.
    const dec = await tx.user.updateMany({
      where: { id: userId, coins: { gte: cost } },
      data: { coins: { decrement: cost } },
    });
    if (dec.count === 0) return null;
    // skipDuplicates makes a same-chapter race a no-op instead of a 500; if it
    // didn't insert, another request already unlocked it — roll back the charge.
    const ins = await tx.unlockedChapter.createMany({
      data: [{ userId, chapterId, coinSpent: cost }],
      skipDuplicates: true,
    });
    if (ins.count === 0) throw new Error("ALREADY_UNLOCKED_RACE");
    await tx.coinTransaction.create({
      data: {
        userId,
        amount: -cost,
        type: "SPEND",
        description:
          vipRate > 0
            ? `ปลดล็อกตอนที่ ${chapter.chapterNum} (VIP ลด 10%)`
            : `ปลดล็อกตอนที่ ${chapter.chapterNum}`,
        refId: chapterId,
      },
    });
    if (translatorId) {
      await tx.translatorEarning.create({
        data: {
          translatorId,
          chapterId,
          mangaId: chapter.mangaId,
          userId,
          coinsSpent: cost,
          amount: earningAmount,
        },
      });
    }
    return tx.user.findUnique({ where: { id: userId }, select: { coins: true } });
  }).catch((err: unknown) => {
    // A racing unlock of the same chapter already won → treat as already unlocked.
    if (err instanceof Error && err.message === "ALREADY_UNLOCKED_RACE") return "RACE" as const;
    throw err;
  });

  if (updatedUser === "RACE") return { success: false, error: "ALREADY_UNLOCKED" };
  if (!updatedUser) return { success: false, error: "INSUFFICIENT_COINS" };
  return { success: true, coinsLeft: updatedUser.coins };
}

export type BulkUnlockResult =
  | {
      success: true;
      unlockedCount: number;
      coinsSpent: number;
      coinsSaved: number;
      discountRate: number;
      coinsLeft: number;
    }
  | { success: false; error: "NOTHING_TO_UNLOCK" | "INSUFFICIENT_COINS" };

/**
 * Unlock several premium chapters at once. Skips chapters that aren't premium
 * or are already unlocked, charges the combined cost atomically, and credits
 * each chapter's translator their share.
 */
export async function unlockChaptersBulk(
  userId: string,
  chapterIds: string[]
): Promise<BulkUnlockResult> {
  const ids = [...new Set(chapterIds)].slice(0, 500);
  if (ids.length === 0) return { success: false, error: "NOTHING_TO_UNLOCK" };

  const chapters = await prisma.chapter.findMany({
    where: { id: { in: ids }, isPremium: true },
    select: {
      id: true, coinCost: true, mangaId: true,
      manga: { select: { translatorId: true } },
    },
  });
  if (chapters.length === 0) return { success: false, error: "NOTHING_TO_UNLOCK" };

  // Drop ones the user already owns.
  const owned = await prisma.unlockedChapter.findMany({
    where: { userId, chapterId: { in: chapters.map((c) => c.id) } },
    select: { chapterId: true },
  });
  const ownedSet = new Set(owned.map((o) => o.chapterId));
  const toUnlock = chapters.filter((c) => !ownedSet.has(c.id));
  if (toUnlock.length === 0) return { success: false, error: "NOTHING_TO_UNLOCK" };

  const buyer = await prisma.user.findUnique({
    where: { id: userId },
    select: { vipExpiresAt: true },
  });
  const vipRate = isVipActive(buyer?.vipExpiresAt) ? VIP_UNLOCK_DISCOUNT : 0;
  const rawCost = toUnlock.reduce((sum, c) => sum + c.coinCost, 0);
  const discountRate = bulkDiscountRate(toUnlock.length);
  // Bulk + VIP discounts stack multiplicatively. `keep` = fraction the user pays.
  // Translator earns on the discounted amount too (prorated per chapter) so the
  // platform's margin never goes negative.
  const keep = (1 - discountRate) * (1 - vipRate);
  const totalCost = Math.round(rawCost * keep);
  const coinsSaved = rawCost - totalCost;

  const result = await prisma.$transaction(async (tx) => {
    // Conditional decrement guards against double-spend / negative balance.
    const dec = await tx.user.updateMany({
      where: { id: userId, coins: { gte: totalCost } },
      data: { coins: { decrement: totalCost } },
    });
    if (dec.count === 0) return null;

    await tx.unlockedChapter.createMany({
      data: toUnlock.map((c) => ({
        userId,
        chapterId: c.id,
        coinSpent: Math.round(c.coinCost * keep),
      })),
      skipDuplicates: true,
    });
    await tx.coinTransaction.create({
      data: {
        userId,
        amount: -totalCost,
        type: "SPEND",
        description:
          coinsSaved > 0
            ? `ปลดล็อก ${toUnlock.length} ตอน (ลด ${Math.round((1 - keep) * 100)}%${vipRate > 0 ? " · VIP" : ""})`
            : `ปลดล็อก ${toUnlock.length} ตอน`,
        refId: toUnlock[0].mangaId,
      },
    });
    const earnings = toUnlock
      .filter((c) => c.manga?.translatorId)
      .map((c) => {
        const charged = Math.round(c.coinCost * keep);
        return {
          translatorId: c.manga!.translatorId!,
          chapterId: c.id,
          mangaId: c.mangaId,
          userId,
          coinsSpent: charged,
          amount: parseFloat((charged * TRANSLATOR_SHARE).toFixed(2)),
        };
      });
    if (earnings.length) await tx.translatorEarning.createMany({ data: earnings });

    const u = await tx.user.findUnique({ where: { id: userId }, select: { coins: true } });
    return u;
  });

  if (!result) return { success: false, error: "INSUFFICIENT_COINS" };
  return {
    success: true,
    unlockedCount: toUnlock.length,
    coinsSpent: totalCost,
    coinsSaved,
    discountRate,
    coinsLeft: result.coins,
  };
}

/**
 * Grant the one-time signup bonus. Idempotent: a marker CoinTransaction keyed by
 * `signup:<userId>` guarantees a user can never receive it twice (re-runs, retries,
 * or being called from both the OAuth adapter and the credentials register route).
 * Safe to call right after a User row is created.
 */
export async function grantSignupBonus(userId: string): Promise<void> {
  try {
    await prisma.$transaction(async (tx) => {
      const already = await tx.coinTransaction.findFirst({
        where: { userId, refId: `signup:${userId}` },
        select: { id: true },
      });
      if (already) return;
      await tx.coinTransaction.create({
        data: {
          userId,
          amount: SIGNUP_BONUS_COINS,
          type: "BONUS",
          description: "โบนัสสมัครสมาชิกใหม่",
          refId: `signup:${userId}`,
        },
      });
      await tx.user.update({
        where: { id: userId },
        data: { coins: { increment: SIGNUP_BONUS_COINS } },
      });
    });
  } catch (err) {
    // Non-critical: never block account creation if the bonus fails.
    console.error("[grantSignupBonus]", err);
  }
}

/**
 * First-top-up "2x" promo. On a user's very first credited top-up, returns an
 * EXTRA coin amount equal to the package's base coins (doubling the purchase) and
 * records a one-time BONUS marker keyed by `firsttopup:<userId>`. Every later call
 * returns 0. Must be called INSIDE the same interactive transaction that credits
 * the top-up, so the extra coins and the marker commit atomically with it. The
 * caller is responsible for adding the returned amount to `user.coins`.
 */
export async function applyFirstTopupBonus(
  tx: Prisma.TransactionClient,
  userId: string,
  baseCoins: number
): Promise<number> {
  const already = await tx.coinTransaction.findFirst({
    where: { userId, refId: `firsttopup:${userId}` },
    select: { id: true },
  });
  if (already) return 0;
  await tx.coinTransaction.create({
    data: {
      userId,
      amount: baseCoins,
      type: "BONUS",
      description: `โบนัสเติมครั้งแรก รับ 2 เท่า (+${baseCoins})`,
      refId: `firsttopup:${userId}`,
    },
  });
  return baseCoins;
}

// ── Daily check-in ──────────────────────────────────────────────────────────
export const DAILY_CHECKIN_BASE = 2; // coins per day
export const DAILY_CHECKIN_STREAK_BONUS = 10; // extra coins every 7th day in a row
const DAY_MS = 24 * 60 * 60 * 1000;

// Midnight UTC of the given day — the canonical key for one check-in per day.
function dayStartUTC(d = new Date()): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function checkInReward(streak: number): number {
  return DAILY_CHECKIN_BASE + (streak % 7 === 0 ? DAILY_CHECKIN_STREAK_BONUS : 0);
}

export type CheckInStatus = {
  claimedToday: boolean;
  streak: number;
  nextReward: number;
};

export async function getCheckInStatus(userId: string): Promise<CheckInStatus> {
  const today = dayStartUTC();
  const last = await prisma.dailyCheckIn.findFirst({
    where: { userId },
    orderBy: { date: "desc" },
  });
  const claimedToday = !!last && last.date.getTime() === today.getTime();
  // Streak continues only if the last check-in was today or yesterday.
  const continues =
    !!last &&
    (last.date.getTime() === today.getTime() ||
      last.date.getTime() === today.getTime() - DAY_MS);
  const currentStreak = continues ? last!.streak : 0;
  const nextStreak = claimedToday ? currentStreak : currentStreak + 1;
  return {
    claimedToday,
    streak: currentStreak,
    nextReward: checkInReward(nextStreak),
  };
}

export type CheckInResult =
  | { success: true; coinsEarned: number; streak: number; coinsTotal: number }
  | { success: false; error: "ALREADY_CLAIMED" };

export async function claimDailyCheckIn(userId: string): Promise<CheckInResult> {
  const today = dayStartUTC();
  const last = await prisma.dailyCheckIn.findFirst({
    where: { userId },
    orderBy: { date: "desc" },
  });
  if (last && last.date.getTime() === today.getTime())
    return { success: false, error: "ALREADY_CLAIMED" };

  const streak =
    last && last.date.getTime() === today.getTime() - DAY_MS ? last.streak + 1 : 1;
  const coinsEarned = checkInReward(streak);

  try {
    const user = await prisma.$transaction(async (tx) => {
      // Unique (userId, date) makes this the single source of truth: a racing
      // request hits the constraint and throws, so coins are credited once.
      await tx.dailyCheckIn.create({
        data: { userId, date: today, coinsEarned, streak },
      });
      await tx.coinTransaction.create({
        data: {
          userId,
          amount: coinsEarned,
          type: "BONUS",
          description: `เช็คอินรายวัน (สตรีค ${streak} วัน)`,
          refId: `checkin:${userId}:${today.toISOString().slice(0, 10)}`,
        },
      });
      return tx.user.update({
        where: { id: userId },
        data: { coins: { increment: coinsEarned } },
      });
    });
    return { success: true, coinsEarned, streak, coinsTotal: user.coins };
  } catch {
    // Unique violation → already claimed today (concurrent request won the race).
    return { success: false, error: "ALREADY_CLAIMED" };
  }
}

// ── Referral ─────────────────────────────────────────────────────────────────
export const REFERRAL_REWARD_COINS = 50; // each side, paid on referee's first top-up

/**
 * Attribute a new user to a referrer (referrer identified by username `refCode`).
 * No-ops on empty/unknown code, self-referral, or an already-attributed referee
 * (the @unique on refereeId). Best-effort: never blocks signup.
 */
export async function recordReferral(refereeId: string, refCode: string): Promise<void> {
  try {
    const code = (refCode || "").trim();
    if (!code) return;
    const referrer = await prisma.user.findUnique({
      where: { username: code },
      select: { id: true },
    });
    if (!referrer || referrer.id === refereeId) return;
    await prisma.referral.create({
      data: { referrerId: referrer.id, refereeId },
    });
  } catch {
    // Unique violation (already referred) or any error → ignore.
  }
}

/**
 * Pay out a pending referral when the referee makes their FIRST top-up. Credits
 * REFERRAL_REWARD_COINS to both sides and marks the referral REWARDED. Must run
 * inside the crediting transaction. Idempotent via the PENDING → REWARDED guard.
 */
export async function rewardReferralOnFirstTopup(
  tx: Prisma.TransactionClient,
  refereeId: string
): Promise<void> {
  const ref = await tx.referral.findUnique({
    where: { refereeId },
    select: { id: true, referrerId: true, status: true },
  });
  if (!ref || ref.status !== "PENDING") return;

  const flipped = await tx.referral.updateMany({
    where: { id: ref.id, status: "PENDING" },
    data: { status: "REWARDED", rewardedAt: new Date(), coinsAwarded: REFERRAL_REWARD_COINS * 2 },
  });
  if (flipped.count === 0) return; // raced

  await tx.user.update({
    where: { id: ref.referrerId },
    data: { coins: { increment: REFERRAL_REWARD_COINS } },
  });
  await tx.coinTransaction.create({
    data: {
      userId: ref.referrerId,
      amount: REFERRAL_REWARD_COINS,
      type: "BONUS",
      description: "รางวัลชวนเพื่อน (เพื่อนเติมเงินครั้งแรก)",
      refId: `referral:${refereeId}`,
    },
  });
  await tx.user.update({
    where: { id: refereeId },
    data: { coins: { increment: REFERRAL_REWARD_COINS } },
  });
  await tx.coinTransaction.create({
    data: {
      userId: refereeId,
      amount: REFERRAL_REWARD_COINS,
      type: "BONUS",
      description: "โบนัสจากคำเชิญของเพื่อน",
      refId: `referral-bonus:${refereeId}`,
    },
  });
}

export type ReferralStats = {
  code: string;
  total: number;
  rewarded: number;
  coinsEarned: number;
};

export async function getReferralStats(userId: string): Promise<ReferralStats> {
  const [user, refs] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { username: true } }),
    prisma.referral.findMany({ where: { referrerId: userId }, select: { status: true } }),
  ]);
  const rewarded = refs.filter((r) => r.status === "REWARDED").length;
  return {
    code: user?.username ?? "",
    total: refs.length,
    rewarded,
    coinsEarned: rewarded * REFERRAL_REWARD_COINS,
  };
}

// ── Tipping a translator ─────────────────────────────────────────────────────
export const TIP_TRANSLATOR_SHARE = 0.90; // tips are a gift → translator keeps 90%

export type TipResult =
  | { success: true; coinsLeft: number; amountThb: number }
  | { success: false; error: "INVALID_AMOUNT" | "INSUFFICIENT_COINS" | "TRANSLATOR_NOT_FOUND" | "SELF_TIP" };

/**
 * Tip a translator with coins. Deducts the reader's coins and credits the
 * translator a TIP earning (90% share). Atomic + guarded against overspend.
 */
export async function tipTranslator(
  userId: string,
  translatorId: string,
  coins: number
): Promise<TipResult> {
  if (!Number.isInteger(coins) || coins < 1 || coins > 100000) {
    return { success: false, error: "INVALID_AMOUNT" };
  }
  const translator = await prisma.translator.findUnique({
    where: { id: translatorId },
    select: { id: true, userId: true, penName: true },
  });
  if (!translator) return { success: false, error: "TRANSLATOR_NOT_FOUND" };
  if (translator.userId === userId) return { success: false, error: "SELF_TIP" };

  const amountThb = parseFloat((coins * TIP_TRANSLATOR_SHARE).toFixed(2));

  const result = await prisma.$transaction(async (tx) => {
    const dec = await tx.user.updateMany({
      where: { id: userId, coins: { gte: coins } },
      data: { coins: { decrement: coins } },
    });
    if (dec.count === 0) return null;

    await tx.coinTransaction.create({
      data: {
        userId,
        amount: -coins,
        type: "SPEND",
        description: `ทิปนักแปล ${translator.penName}`,
        refId: `tip:${translatorId}`,
      },
    });
    await tx.translatorEarning.create({
      data: {
        translatorId,
        chapterId: null,
        mangaId: null,
        userId,
        type: "TIP",
        coinsSpent: coins,
        amount: amountThb,
      },
    });
    return tx.user.findUnique({ where: { id: userId }, select: { coins: true } });
  });

  if (!result) return { success: false, error: "INSUFFICIENT_COINS" };
  return { success: true, coinsLeft: result.coins, amountThb };
}

// ── Translator identity verification (paid + admin-approved) ─────────────────
export const VERIFY_FEE_COINS = 500;

export type VerifyRequestResult =
  | { success: true }
  | { success: false; error: "NOT_TRANSLATOR" | "ALREADY_VERIFIED" | "PENDING_EXISTS" | "INSUFFICIENT_COINS" };

/**
 * Submit a verification request. Charges VERIFY_FEE_COINS up front (refunded on
 * rejection). Translator-only, one active request at a time; a previously
 * rejected request can be re-submitted.
 */
export async function requestVerification(userId: string): Promise<VerifyRequestResult> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { coins: true, verifiedAt: true, translator: { select: { id: true } } },
  });
  if (!user || !user.translator) return { success: false, error: "NOT_TRANSLATOR" };
  if (user.verifiedAt) return { success: false, error: "ALREADY_VERIFIED" };

  const existing = await prisma.verificationRequest.findUnique({ where: { userId } });
  if (existing && existing.status === "PENDING") return { success: false, error: "PENDING_EXISTS" };

  const ok = await prisma.$transaction(async (tx) => {
    const dec = await tx.user.updateMany({
      where: { id: userId, coins: { gte: VERIFY_FEE_COINS } },
      data: { coins: { decrement: VERIFY_FEE_COINS } },
    });
    if (dec.count === 0) return false;
    await tx.coinTransaction.create({
      data: {
        userId,
        amount: -VERIFY_FEE_COINS,
        type: "SPEND",
        description: "ค่าธรรมเนียมยืนยันตัวตน",
        refId: `verify:${userId}`,
      },
    });
    await tx.verificationRequest.upsert({
      where: { userId },
      create: { userId, status: "PENDING", coinsPaid: VERIFY_FEE_COINS },
      update: { status: "PENDING", coinsPaid: VERIFY_FEE_COINS, adminNote: null, reviewedAt: null, createdAt: new Date() },
    });
    return true;
  });
  if (!ok) return { success: false, error: "INSUFFICIENT_COINS" };
  return { success: true };
}

/**
 * Admin decision on a verification request. Approve → set user.verifiedAt.
 * Reject → refund the fee. Returns the affected userId, or null if not pending.
 */
export async function reviewVerification(
  requestId: string,
  approve: boolean,
  note?: string
): Promise<string | null> {
  const reqRow = await prisma.verificationRequest.findUnique({ where: { id: requestId } });
  if (!reqRow || reqRow.status !== "PENDING") return null;

  if (approve) {
    await prisma.$transaction([
      prisma.verificationRequest.update({
        where: { id: requestId },
        data: { status: "APPROVED", reviewedAt: new Date(), adminNote: note ?? null },
      }),
      prisma.user.update({ where: { id: reqRow.userId }, data: { verifiedAt: new Date() } }),
    ]);
  } else {
    await prisma.$transaction([
      prisma.verificationRequest.update({
        where: { id: requestId },
        data: { status: "REJECTED", reviewedAt: new Date(), adminNote: note ?? null },
      }),
      prisma.user.update({ where: { id: reqRow.userId }, data: { coins: { increment: reqRow.coinsPaid } } }),
      prisma.coinTransaction.create({
        data: {
          userId: reqRow.userId,
          amount: reqRow.coinsPaid,
          type: "REFUND",
          description: "คืนค่าธรรมเนียมยืนยันตัวตน (ไม่ผ่าน)",
          refId: `verify-refund:${reqRow.userId}`,
        },
      }),
    ]);
  }
  return reqRow.userId;
}
