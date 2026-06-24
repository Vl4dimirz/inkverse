import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { Eye, UserPlus, BookOpen, Repeat, ArrowLeft, AlertCircle } from "lucide-react";

export const metadata = { title: "ภาพรวม Funnel — แอดมิน" };

const SEED = "@seed.inkverse.local";
const DAY = 86_400_000;
const dayKey = (d: Date) => d.toISOString().slice(0, 10);
const pct = (num: number, den: number) => (den > 0 ? Math.round((num / den) * 1000) / 10 : 0);

export default async function AdminAnalyticsPage() {
  const session = await auth();
  if (!session?.user || (session.user as { role?: string }).role !== "ADMIN") {
    redirect("/");
  }

  const now = new Date();
  const since30 = new Date(now.getTime() - 30 * DAY);
  const since14 = new Date(now.getTime() - 14 * DAY);
  const since7 = new Date(now.getTime() - 7 * DAY);

  // New, real users in the last 30 days = the cohort we measure activation/retention on.
  const newUsers = await prisma.user.findMany({
    where: { createdAt: { gte: since30 }, NOT: { email: { endsWith: SEED } } },
    select: { id: true, createdAt: true },
  });
  const cohortIds = newUsers.map((u) => u.id);

  const [dailyStats, cohortReads, recentReads, topChapterGroups] = await Promise.all([
    prisma.dailyStat.findMany({
      where: { day: { gte: dayKey(since30) } },
      orderBy: { day: "asc" },
    }),
    // Reads by the new-user cohort → activation (read ≥1) + retention (≥2 active days).
    cohortIds.length
      ? prisma.readHistory.findMany({
          where: { userId: { in: cohortIds } },
          select: { userId: true, readAt: true },
        })
      : Promise.resolve([] as { userId: string; readAt: Date }[]),
    // All reads in the last 14 days → daily active readers.
    prisma.readHistory.findMany({
      where: { readAt: { gte: since14 } },
      select: { userId: true, readAt: true },
    }),
    // Most-read chapters in the last 7 days → roll up to titles below.
    prisma.readHistory.groupBy({
      by: ["chapterId"],
      where: { readAt: { gte: since7 } },
      _count: { _all: true },
    }),
  ]);

  // ── Top-of-funnel traffic (DailyStat is daily aggregates) ───────────────────
  const visitors30 = dailyStats.reduce((s, d) => s + d.visitors, 0);
  const pageViews30 = dailyStats.reduce((s, d) => s + d.pageViews, 0);
  const pagesPerVisitor = visitors30 > 0 ? Math.round((pageViews30 / visitors30) * 10) / 10 : 0;

  // ── Signups + activation + retention (the new-user cohort) ──────────────────
  const signups30 = newUsers.length;

  const readsByUser = new Map<string, Set<string>>();
  for (const r of cohortReads) {
    const set = readsByUser.get(r.userId) ?? new Set<string>();
    set.add(dayKey(new Date(r.readAt)));
    readsByUser.set(r.userId, set);
  }
  const activated = readsByUser.size; // read ≥1 chapter
  let returning = 0; // showed up to read on ≥2 distinct days
  for (const days of readsByUser.values()) if (days.size >= 2) returning++;

  // ── Last-14-day series: visitors / signups / active readers ─────────────────
  const visByDay = new Map(dailyStats.map((d) => [d.day, d]));
  const signupsByDay = new Map<string, number>();
  for (const u of newUsers) {
    const k = dayKey(new Date(u.createdAt));
    signupsByDay.set(k, (signupsByDay.get(k) ?? 0) + 1);
  }
  const dauByDay = new Map<string, Set<string>>();
  for (const r of recentReads) {
    const k = dayKey(new Date(r.readAt));
    const set = dauByDay.get(k) ?? new Set<string>();
    set.add(r.userId);
    dauByDay.set(k, set);
  }
  const days14 = Array.from({ length: 14 }, (_, i) => dayKey(new Date(now.getTime() - (13 - i) * DAY)));
  const series = days14.map((k) => ({
    day: k,
    visitors: visByDay.get(k)?.visitors ?? 0,
    pageViews: visByDay.get(k)?.pageViews ?? 0,
    signups: signupsByDay.get(k) ?? 0,
    readers: dauByDay.get(k)?.size ?? 0,
  }));
  const maxVis = Math.max(1, ...series.map((s) => s.visitors));

  // ── What the wave is reading (top titles, 7d) ───────────────────────────────
  const chapterIds = topChapterGroups.map((g) => g.chapterId);
  const chapters = chapterIds.length
    ? await prisma.chapter.findMany({
        where: { id: { in: chapterIds } },
        select: { id: true, manga: { select: { title: true, slug: true } } },
      })
    : [];
  const chapterToManga = new Map(chapters.map((c) => [c.id, c.manga]));
  const byManga = new Map<string, { title: string; slug: string; reads: number }>();
  for (const g of topChapterGroups) {
    const m = chapterToManga.get(g.chapterId);
    if (!m) continue;
    const cur = byManga.get(m.slug) ?? { title: m.title, slug: m.slug, reads: 0 };
    cur.reads += g._count._all;
    byManga.set(m.slug, cur);
  }
  const topTitles = [...byManga.values()].sort((a, b) => b.reads - a.reads).slice(0, 8);
  const maxReads = Math.max(1, ...topTitles.map((t) => t.reads));

  const funnel = [
    { label: "ผู้เข้าชม (30 วัน)", sub: "นับซ้ำข้ามวัน", value: visitors30, icon: Eye, rate: null as string | null },
    { label: "สมัครสมาชิก", sub: "ผู้ใช้ใหม่จริง", value: signups30, icon: UserPlus, rate: `${pct(signups30, visitors30)}% ของผู้เข้าชม` },
    { label: "เริ่มอ่าน", sub: "อ่าน ≥1 ตอน", value: activated, icon: BookOpen, rate: `${pct(activated, signups30)}% ของผู้สมัคร` },
    { label: "กลับมาอ่านอีก", sub: "อ่าน ≥2 วันต่างกัน", value: returning, icon: Repeat, rate: `${pct(returning, signups30)}% ของผู้สมัคร` },
  ];

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
      <Link href="/admin" className="inline-flex items-center gap-1.5 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] mb-4">
        <ArrowLeft className="w-3.5 h-3.5" /> กลับแผงแอดมิน
      </Link>
      <h1 className="font-bebas text-4xl text-[var(--text-primary)] tracking-wider mb-1">ภาพรวม Funnel</h1>
      <p className="text-sm text-[var(--text-secondary)] mb-8">30 วันล่าสุด · เส้นทางจากคนเข้าชม → สมัคร → อ่าน → กลับมาอีก</p>

      {/* Funnel */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-3">
        {funnel.map(({ label, sub, value, icon: Icon, rate }) => (
          <div key={label} className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border)] p-5">
            <Icon className="w-6 h-6 text-[var(--text-primary)] mb-3" />
            <p className="text-3xl font-bold text-[var(--text-primary)] mb-0.5">{value.toLocaleString()}</p>
            <p className="text-sm text-[var(--text-primary)]">{label}</p>
            <p className="text-[11px] text-[var(--text-muted)] mt-0.5">{sub}</p>
            {rate && <p className="text-[11px] text-[var(--text-secondary)] mt-2 border-t border-[var(--border)] pt-2">{rate}</p>}
          </div>
        ))}
      </div>
      <p className="text-[11px] text-[var(--text-muted)] mb-10">
        เพจ/คน: <span className="text-[var(--text-secondary)]">{pagesPerVisitor}</span> · เพจวิวรวม 30 วัน: {pageViews30.toLocaleString()}
      </p>

      {/* 14-day series */}
      <h2 className="font-bebas text-2xl text-[var(--text-primary)] tracking-[0.18em] uppercase flex items-center gap-3 mb-4">
        <span className="w-6 h-px bg-[var(--text-primary)]" /> รายวัน 14 วัน
      </h2>
      <div className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border)] overflow-hidden mb-10">
        <div className="grid grid-cols-[5rem_1fr_4rem_4rem] gap-2 px-4 py-2.5 text-[10px] uppercase tracking-wider text-[var(--text-muted)] border-b border-[var(--border)]">
          <span>วันที่</span><span>ผู้เข้าชม</span><span className="text-right">สมัคร</span><span className="text-right">อ่าน</span>
        </div>
        {series.map((s) => (
          <div key={s.day} className="grid grid-cols-[5rem_1fr_4rem_4rem] gap-2 items-center px-4 py-2 text-xs border-b border-[var(--border)] last:border-0">
            <span className="text-[var(--text-secondary)]">{s.day.slice(5)}</span>
            <span className="flex items-center gap-2">
              <span className="h-3 bg-[var(--text-primary)]" style={{ width: `${Math.round((s.visitors / maxVis) * 100)}%`, minWidth: s.visitors ? 2 : 0 }} />
              <span className="text-[var(--text-secondary)] tabular-nums">{s.visitors.toLocaleString()}</span>
            </span>
            <span className="text-right tabular-nums text-[var(--text-primary)]">{s.signups || "·"}</span>
            <span className="text-right tabular-nums text-[var(--text-secondary)]">{s.readers || "·"}</span>
          </div>
        ))}
      </div>

      {/* Top titles */}
      <h2 className="font-bebas text-2xl text-[var(--text-primary)] tracking-[0.18em] uppercase flex items-center gap-3 mb-4">
        <span className="w-6 h-px bg-[var(--text-primary)]" /> เรื่องที่อ่านเยอะสุด 7 วัน
      </h2>
      <div className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border)] p-5 mb-10">
        {topTitles.length === 0 ? (
          <p className="text-sm text-[var(--text-muted)]">ยังไม่มีการอ่านในช่วง 7 วัน</p>
        ) : (
          <div className="space-y-2.5">
            {topTitles.map((t) => (
              <div key={t.slug} className="flex items-center gap-3 text-xs">
                <Link href={`/content/${t.slug}`} className="w-44 sm:w-56 shrink-0 truncate text-[var(--text-primary)] hover:underline">{t.title}</Link>
                <div className="flex-1 h-3 bg-[var(--bg-card)] overflow-hidden">
                  <div className="h-full bg-[var(--text-primary)]" style={{ width: `${Math.round((t.reads / maxReads) * 100)}%` }} />
                </div>
                <span className="w-16 shrink-0 text-right text-[var(--text-secondary)] tabular-nums">{t.reads.toLocaleString()} อ่าน</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Blind spots */}
      <div className="border border-[var(--border)] bg-[var(--bg-card)] rounded-2xl p-5">
        <div className="flex items-start gap-2 mb-2">
          <AlertCircle className="w-4 h-4 text-[var(--text-primary)] shrink-0 mt-0.5" />
          <p className="text-sm font-semibold text-[var(--text-primary)]">จุดบอดที่ยังวัดไม่ได้ (ต้องเก็บ data เพิ่ม)</p>
        </div>
        <ul className="text-xs text-[var(--text-secondary)] leading-relaxed space-y-1.5 pl-6 list-disc">
          <li><span className="text-[var(--text-primary)]">คนเข้าชมแบบไม่ล็อกอินอ่านลึกแค่ไหนก่อนเด้งออก</span> — ตอนนี้ ReadHistory เก็บเฉพาะคนล็อกอิน เลยมองไม่เห็น bounce ของคน TikTok ที่ยังไม่สมัคร</li>
          <li><span className="text-[var(--text-primary)]">มาจากไหน</span> (TikTok / direct / search) — ไม่ได้เก็บ referrer</li>
          <li><span className="text-[var(--text-primary)]">landing page</span> — DailyStat เก็บแค่ยอดรวม ไม่รู้ว่าคนลงหน้าไหนก่อน</li>
        </ul>
        <p className="text-[11px] text-[var(--text-muted)] mt-3">
          วิธีอุด: เพิ่มตาราง event เบาๆ (path + referrer + anon id ใน /api/track) → ปลดล็อก bounce rate, source, landing funnel ของ anonymous ได้ครบ
        </p>
      </div>
    </div>
  );
}
