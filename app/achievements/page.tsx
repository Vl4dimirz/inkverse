import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  evaluateAchievements,
  getAchievementProgress,
  CATEGORY_LABEL,
  type AchievementCategory,
  type AchievementProgress,
} from "@/lib/achievements";
import { getReaderRank } from "@/lib/ranks";
import {
  BookOpen, BookText, Library, Flame, Crown, CheckCircle2, Trophy,
  Compass, Bookmark, Star, Unlock, Coins, CalendarCheck, Lock, Check,
  Sprout, Footprints, Swords, Shield, Gem, ArrowRight,
} from "lucide-react";
import type { Metadata } from "next";
import type { ComponentType } from "react";

export const metadata: Metadata = {
  title: "ความสำเร็จ — INKVERSE",
  description: "เก็บความสำเร็จจากการอ่าน รับเหรียญรางวัล",
};

const ICONS: Record<string, ComponentType<{ className?: string }>> = {
  BookOpen, BookText, Library, Flame, Crown, CheckCircle2, Trophy,
  Compass, Bookmark, Star, Unlock, Coins, CalendarCheck,
};

const RANK_ICONS: Record<string, ComponentType<{ className?: string }>> = {
  Sprout, Footprints, BookOpen, Swords, Flame, Shield, Gem, Crown,
};

export default async function AchievementsPage() {
  const session = await auth();
  if (!session?.user) redirect("/auth/signin?callbackUrl=/achievements");
  const userId = (session.user as { id: string }).id;

  // Catch achievements unlocked by non-reading actions (topup, rating, …).
  await evaluateAchievements(userId);
  const [{ items, unlockedCount, stats }, coinSpentAgg] = await Promise.all([
    getAchievementProgress(userId),
    prisma.unlockedChapter.aggregate({ where: { userId }, _sum: { coinSpent: true } }),
  ]);

  const coinsSpent = coinSpentAgg._sum.coinSpent ?? 0;
  const rank = getReaderRank(stats.chaptersRead, coinsSpent);
  const RankIcon = RANK_ICONS[rank.current.icon] ?? BookOpen;

  const coinsEarned = items
    .filter((i) => i.unlocked)
    .reduce((s, i) => s + i.coinReward, 0);

  const categories = ["reading", "completion", "social", "engagement"] as AchievementCategory[];
  const byCat = (c: AchievementCategory) => items.filter((i) => i.category === c);

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10">
      {/* Header */}
      <div className="mb-8">
        <p className="eyebrow text-[var(--text-secondary)]">CHALLENGES</p>
        <h1 className="font-bebas text-4xl sm:text-5xl text-[var(--text-primary)] tracking-wider flex items-center gap-3">
          <Trophy className="w-8 h-8" /> ความสำเร็จ
        </h1>
        <p className="text-sm text-[var(--text-secondary)] mt-2">
          อ่าน อ่านจบ และมีส่วนร่วม เพื่อปลดล็อกความสำเร็จและรับเหรียญรางวัล
        </p>

        {/* Summary */}
        <div className="grid grid-cols-3 gap-3 mt-5">
          <div className="bg-[var(--bg-surface)] border border-[var(--border)] p-4">
            <p className="text-2xl font-bold text-[var(--text-primary)]">
              {unlockedCount}/{items.length}
            </p>
            <p className="text-xs uppercase tracking-wide text-[var(--text-secondary)] mt-0.5">
              ปลดล็อกแล้ว
            </p>
          </div>
          <div className="bg-[var(--bg-surface)] border border-[var(--border)] p-4">
            <p className="text-2xl font-bold text-[var(--text-primary)] flex items-center gap-1">
              <Coins className="w-5 h-5" /> {coinsEarned}
            </p>
            <p className="text-xs uppercase tracking-wide text-[var(--text-secondary)] mt-0.5">
              เหรียญที่ได้รับ
            </p>
          </div>
          <div className="bg-[var(--bg-surface)] border border-[var(--border)] p-4">
            <p className="text-2xl font-bold text-[var(--text-primary)]">
              {Math.round((unlockedCount / items.length) * 100)}%
            </p>
            <p className="text-xs uppercase tracking-wide text-[var(--text-secondary)] mt-0.5">
              ความคืบหน้า
            </p>
          </div>
        </div>
      </div>

      {/* Reader rank — progress + what's missing to rank up */}
      <div className="mb-10 border border-[var(--text-primary)]/30 bg-[var(--bg-surface)] p-5">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 flex items-center justify-center bg-[var(--text-primary)] text-[var(--bg-primary)] shrink-0">
            <RankIcon className="w-8 h-8" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] uppercase tracking-[0.3em] text-[var(--text-muted)]">
              CURRENT RANK · LV.{rank.current.level}
            </p>
            <p className="font-bebas text-3xl text-[var(--text-primary)] tracking-wider uppercase">
              {rank.current.nameEn}
            </p>
          </div>
        </div>

        {rank.next ? (
          <div className="mt-4">
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="text-[var(--text-secondary)] flex items-center gap-1">
                ยศถัดไป <ArrowRight className="w-3 h-3" />{" "}
                <span className="text-[var(--text-primary)] font-semibold uppercase">{rank.next.nameEn}</span>
              </span>
              <span className="text-[var(--text-primary)] font-semibold">{rank.percentToNext}%</span>
            </div>
            <div className="h-2 w-full bg-[var(--bg-card)] border border-[var(--border)] overflow-hidden">
              <div className="h-full bg-[var(--text-primary)] transition-all" style={{ width: `${rank.percentToNext}%` }} />
            </div>
            {/* What's still missing */}
            <div className="flex flex-wrap gap-2 mt-3">
              <span className={`text-[11px] px-2 py-1 border flex items-center gap-1 ${rank.readsToNext > 0 ? "border-[var(--border)] text-[var(--text-secondary)]" : "border-[var(--text-primary)]/40 text-[var(--text-primary)]"}`}>
                {rank.readsToNext > 0 ? <BookOpen className="w-3 h-3" /> : <Check className="w-3 h-3" />}
                {rank.readsToNext > 0 ? `อ่านอีก ${rank.readsToNext} ตอน` : "เงื่อนไขการอ่านครบแล้ว"}
              </span>
              <span className={`text-[11px] px-2 py-1 border flex items-center gap-1 ${rank.coinsToNext > 0 ? "border-[var(--border)] text-[var(--text-secondary)]" : "border-[var(--text-primary)]/40 text-[var(--text-primary)]"}`}>
                {rank.coinsToNext > 0 ? <Coins className="w-3 h-3" /> : <Check className="w-3 h-3" />}
                {rank.coinsToNext > 0 ? `ใช้เหรียญปลดล็อกอีก ${rank.coinsToNext}` : "เงื่อนไขเหรียญครบแล้ว"}
              </span>
            </div>
            {rank.readsToNext === 0 && rank.coinsToNext === 0 && (
              <p className="text-[11px] text-[var(--text-primary)] mt-2">🎉 ครบทุกเงื่อนไข — อ่านอีกตอนเพื่อเลื่อนยศ!</p>
            )}
          </div>
        ) : (
          <p className="text-xs text-[var(--text-primary)] mt-4 flex items-center gap-1">
            <Crown className="w-4 h-4" /> คุณคือยศสูงสุดแล้ว — ตำนานนักอ่าน!
          </p>
        )}
      </div>

      {/* Categories */}
      <div className="space-y-10">
        {categories.map((cat) => (
          <section key={cat}>
            <h2 className="font-bebas text-2xl text-[var(--text-primary)] tracking-[0.18em] uppercase flex items-center gap-3 mb-4">
              <span className="w-6 h-px bg-[var(--text-primary)]" />
              {CATEGORY_LABEL[cat]}
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {byCat(cat).map((a) => (
                <AchievementCard key={a.key} a={a} />
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

function AchievementCard({ a }: { a: AchievementProgress }) {
  const Icon = ICONS[a.icon] ?? Trophy;
  const pct = Math.min(100, Math.round((a.current / a.threshold) * 100));

  return (
    <div
      className={`relative p-4 border transition-colors ${
        a.unlocked
          ? "bg-[var(--bg-surface)] border-[var(--text-primary)]/40"
          : "bg-[var(--bg-card)] border-[var(--border)] opacity-80"
      }`}
    >
      <div className="flex items-start gap-3">
        <div
          className={`w-11 h-11 flex items-center justify-center border shrink-0 ${
            a.unlocked
              ? "bg-[var(--text-primary)] text-[var(--bg-primary)] border-[var(--text-primary)]"
              : "bg-[var(--bg-surface)] text-[var(--text-secondary)] border-[var(--border)]"
          }`}
        >
          {a.unlocked ? <Icon className="w-5 h-5" /> : <Lock className="w-4 h-4" />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-[var(--text-primary)] truncate">
              {a.title}
            </h3>
            <span className="text-[11px] flex items-center gap-0.5 text-[var(--text-secondary)] shrink-0">
              <Coins className="w-3 h-3" /> {a.coinReward}
            </span>
          </div>
          <p className="text-xs text-[var(--text-secondary)] mt-0.5 line-clamp-2">
            {a.description}
          </p>

          {a.unlocked ? (
            <p className="text-[11px] text-[var(--text-primary)] mt-2 flex items-center gap-1">
              <Check className="w-3 h-3" /> ปลดล็อกแล้ว
            </p>
          ) : (
            <div className="mt-2">
              <div className="flex justify-between text-[10px] text-[var(--text-secondary)] mb-1">
                <span>
                  {a.current.toLocaleString()}/{a.threshold.toLocaleString()}
                </span>
                <span>{pct}%</span>
              </div>
              <div className="h-1 w-full bg-[var(--bg-primary)] border border-[var(--border)] overflow-hidden">
                <div className="h-full bg-[var(--text-primary)]" style={{ width: `${pct}%` }} />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
