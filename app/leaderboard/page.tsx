import { prisma } from "@/lib/prisma";
import Link from "next/link";
import Image from "next/image";
import { getReaderRank } from "@/lib/ranks";
import { BookOpen, Trophy, Medal, BadgeCheck } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "อันดับนักอ่าน — INKVERSE",
  description: "จัดอันดับนักอ่านตัวยงของ INKVERSE ใครอ่านเยอะที่สุด",
};

// Refresh hourly — leaderboards don't need to be real-time.
export const revalidate = 3600;

const SEED_SUFFIX = "@seed.inkverse.local";

export default async function LeaderboardPage() {
  // Top readers by chapters read (real accounts only).
  const grouped = await prisma.readHistory.groupBy({
    by: ["userId"],
    _count: { userId: true },
    orderBy: { _count: { userId: "desc" } },
    take: 100,
  });
  const ids = grouped.map((g) => g.userId);

  const [users, spent] = await Promise.all([
    prisma.user.findMany({
      where: { id: { in: ids }, NOT: { email: { endsWith: SEED_SUFFIX } } },
      select: { id: true, username: true, avatarUrl: true, verifiedAt: true, role: true },
    }),
    prisma.unlockedChapter.groupBy({
      by: ["userId"],
      where: { userId: { in: ids } },
      _sum: { coinSpent: true },
    }),
  ]);
  const userMap = new Map(users.map((u) => [u.id, u]));
  const spentMap = new Map(spent.map((s) => [s.userId, s._sum.coinSpent ?? 0]));

  const entries = grouped
    .map((g) => {
      const u = userMap.get(g.userId);
      if (!u) return null;
      const chaptersRead = g._count.userId;
      const rank = getReaderRank(chaptersRead, spentMap.get(g.userId) ?? 0);
      return { ...u, chaptersRead, rankName: rank.current.name, rankLevel: rank.current.level };
    })
    .filter((e): e is NonNullable<typeof e> => e !== null)
    .slice(0, 50);

  const medal = (i: number) =>
    i === 0 ? "text-[var(--text-primary)]" : i === 1 ? "text-[var(--text-primary)]/70" : "text-[var(--text-primary)]/45";

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
      <div className="mb-8">
        <p className="eyebrow text-[var(--text-secondary)]">LEADERBOARD</p>
        <h1 className="font-bebas text-4xl sm:text-5xl text-[var(--text-primary)] tracking-wider flex items-center gap-3">
          <Trophy className="w-8 h-8" /> อันดับนักอ่าน
        </h1>
        <p className="text-sm text-[var(--text-secondary)] mt-2">
          นักอ่านที่อ่านมากที่สุดบน INKVERSE — อ่านให้เยอะเพื่อไต่อันดับและเลื่อนยศ
        </p>
      </div>

      {entries.length === 0 ? (
        <div className="text-center py-16 text-[var(--text-secondary)] text-sm">
          ยังไม่มีข้อมูลการอ่าน
        </div>
      ) : (
        <div className="border border-[var(--border)] divide-y divide-[var(--border)]">
          {entries.map((e, i) => (
            <Link
              key={e.id}
              href={`/profile/${e.username}`}
              className="flex items-center gap-4 px-4 py-3 hover:bg-[var(--bg-surface)] transition-colors"
            >
              <span className="w-8 text-center font-bebas text-xl shrink-0">
                {i < 3 ? <Medal className={`w-5 h-5 mx-auto ${medal(i)}`} /> : (
                  <span className="text-[var(--text-muted)]">{i + 1}</span>
                )}
              </span>
              <div className="relative w-10 h-10 border border-[var(--border)] overflow-hidden bg-[var(--bg-card)] shrink-0">
                {e.avatarUrl ? (
                  <Image src={e.avatarUrl} alt={e.username} fill unoptimized className="object-cover" sizes="40px" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-sm font-bold text-[var(--text-primary)]">
                    {e.username[0]?.toUpperCase()}
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-[var(--text-primary)] truncate flex items-center gap-1">
                  @{e.username}
                  {(e.verifiedAt || e.role === "ADMIN") && (
                    <BadgeCheck className="w-3.5 h-3.5 shrink-0" />
                  )}
                </p>
                <p className="text-[11px] text-[var(--text-secondary)] uppercase tracking-wide">
                  LV.{e.rankLevel} · {e.rankName}
                </p>
              </div>
              <span className="flex items-center gap-1 text-sm text-[var(--text-primary)] shrink-0">
                <BookOpen className="w-4 h-4" /> {e.chaptersRead.toLocaleString()}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
