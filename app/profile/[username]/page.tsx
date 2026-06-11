import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import MangaCard from "@/components/ui/MangaCard";
import ProfileImageButton from "@/components/ui/ProfileImageButton";
import VerificationCard from "@/components/ui/VerificationCard";
import { VERIFY_FEE_COINS } from "@/lib/coins";
import { getReaderRank } from "@/lib/ranks";
import { getUnlockedAchievements } from "@/lib/achievements";
import {
  BookMarked, History, Star, Calendar, Eye, Layers,
  Shield, PenTool, User as UserIcon, BookOpen, Coins, Heart,
  LayoutDashboard, Wallet, Banknote, Settings, Plus, BadgeCheck,
  Sprout, Footprints, Swords, Flame, Gem, Crown, Trophy, ArrowRight,
} from "lucide-react";
import type { Metadata } from "next";
import type { ComponentType } from "react";

const RANK_ICONS: Record<string, ComponentType<{ className?: string }>> = {
  Sprout, Footprints, BookOpen, Swords, Flame, Shield, Gem, Crown,
};

interface Props {
  params: Promise<{ username: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { username } = await params;
  return { title: `โปรไฟล์ ${username}` };
}

const ROLES = {
  READER: { label: "นักอ่าน", icon: UserIcon, eyebrow: "MEMBER", verified: false, chip: "bg-[var(--bg-card)] text-[var(--text-secondary)] border border-[var(--border)]" },
  TRANSLATOR: { label: "นักแปล", icon: PenTool, eyebrow: "VERIFIED CREATOR", verified: true, chip: "bal-btn" },
  ADMIN: { label: "ผู้ดูแลระบบ", icon: Shield, eyebrow: "OFFICIAL · ADMINISTRATOR", verified: true, chip: "bal-btn" },
} as const;

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="font-bebas text-xl text-[var(--text-primary)] tracking-[0.2em] uppercase mb-5 flex items-center gap-2.5 pb-2 border-b border-[var(--border)]">
      {children}
    </h2>
  );
}

export default async function ProfilePage({ params }: Props) {
  const { username } = await params;
  const session = await auth();

  const user = await prisma.user.findUnique({
    where: { username },
    include: {
      bookmarks: {
        take: 12,
        orderBy: { createdAt: "desc" },
        include: {
          manga: {
            include: {
              chapters: { orderBy: { chapterNum: "desc" }, take: 1 },
              ratings: { select: { score: true } },
            },
          },
        },
      },
      readHistory: {
        take: 8,
        orderBy: { readAt: "desc" },
        include: {
          chapter: { include: { manga: { select: { title: true, slug: true, coverUrl: true } } } },
        },
      },
      _count: { select: { bookmarks: true, ratings: true, readHistory: true } },
      verificationRequest: { select: { status: true } },
      translator: {
        include: {
          mangas: {
            orderBy: { updatedAt: "desc" },
            include: {
              chapters: { orderBy: { chapterNum: "desc" }, take: 1 },
              ratings: { select: { score: true } },
              _count: { select: { chapters: true } },
            },
          },
        },
      },
    },
  });

  if (!user) notFound();

  const isOwner = !!session?.user && (session.user as { id?: string }).id === user.id;
  const role = ROLES[user.role as keyof typeof ROLES] ?? ROLES.READER;
  const RoleIcon = role.icon;
  // Paid identity verification (admins are inherently official).
  const isVerified = !!user.verifiedAt || user.role === "ADMIN";
  // Translators only earn the "VERIFIED" eyebrow once actually verified.
  const eyebrow = user.role === "TRANSLATOR" && !isVerified ? "CREATOR" : role.eyebrow;

  const works = user.translator?.mangas ?? [];
  const isCreator = !!user.translator;
  const totalViews = works.reduce((s, m) => s + m.totalViews, 0);
  const totalChapters = works.reduce((s, m) => s + m._count.chapters, 0);
  const displayName = user.translator?.penName || user.username;
  const bio = user.translator?.bio || user.bio;
  const joined = new Date(user.createdAt).toLocaleDateString("th-TH", { year: "numeric", month: "short" });

  // Reader rank (derived from chapters read + coins spent unlocking) + achievements.
  const [coinSpentAgg, unlockedAch] = await Promise.all([
    prisma.unlockedChapter.aggregate({ where: { userId: user.id }, _sum: { coinSpent: true } }),
    getUnlockedAchievements(user.id, 6),
  ]);
  const coinsSpent = coinSpentAgg._sum.coinSpent ?? 0;
  const rank = getReaderRank(user._count.readHistory, coinsSpent);
  const RankIcon = RANK_ICONS[rank.current.icon] ?? BookOpen;

  // Top Fans — readers who spent the most coins on this creator's work (incl. tips).
  let topFans: { id: string; username: string; avatarUrl: string | null; coins: number }[] = [];
  if (user.translator) {
    const fanAgg = await prisma.translatorEarning.groupBy({
      by: ["userId"],
      where: { translatorId: user.translator.id },
      _sum: { coinsSpent: true },
      orderBy: { _sum: { coinsSpent: "desc" } },
      take: 10,
    });
    const fanIds = fanAgg.map((f) => f.userId);
    if (fanIds.length) {
      const fanUsers = await prisma.user.findMany({
        where: { id: { in: fanIds } },
        select: { id: true, username: true, avatarUrl: true },
      });
      const fanMap = new Map(fanUsers.map((u) => [u.id, u]));
      topFans = fanAgg
        .map((f) => {
          const u = fanMap.get(f.userId);
          return u ? { ...u, coins: f._sum.coinsSpent ?? 0 } : null;
        })
        .filter((f): f is NonNullable<typeof f> => !!f && f.coins > 0);
    }
  }

  const stats = isCreator
    ? [
        { icon: BookOpen, label: "ผลงาน", value: works.length },
        { icon: Eye, label: "ยอดวิวรวม", value: totalViews.toLocaleString() },
        { icon: Layers, label: "ตอนทั้งหมด", value: totalChapters.toLocaleString() },
        { icon: Calendar, label: "เข้าร่วม", value: joined },
      ]
    : [
        { icon: BookMarked, label: "บุ๊กมาร์ก", value: user._count.bookmarks },
        { icon: History, label: "อ่านไปแล้ว", value: user._count.readHistory },
        { icon: Star, label: "รีวิว", value: user._count.ratings },
        { icon: Calendar, label: "เข้าร่วม", value: joined },
      ];

  const hasActivity = works.length > 0 || user.bookmarks.length > 0 || user.readHistory.length > 0;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      {/* ── Cover banner ───────────────────────────────────────────── */}
      <div className="relative h-48 sm:h-64 w-full border border-[var(--border)] overflow-hidden bg-[var(--bg-card)]">
        {user.coverUrl ? (
          <Image src={user.coverUrl} alt="" fill unoptimized className="object-cover" priority />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-[var(--bg-card)] via-[var(--bg-surface)] to-[var(--bg-card)]" />
        )}
        {/* legibility fade */}
        <div className="absolute inset-0 bg-gradient-to-t from-[var(--bg-primary)] via-transparent to-transparent" />
        {/* couture inset frame */}
        <div className="absolute inset-3 sm:inset-4 border border-[var(--text-primary)]/15 pointer-events-none" />
        {/* maison wordmark */}
        <span className="absolute left-4 sm:left-6 top-4 sm:top-5 text-[10px] text-[var(--text-primary)]/60 uppercase tracking-[0.4em]">
          INKVERSE
        </span>
        {isOwner && (
          <div className="absolute top-3 right-3">
            <ProfileImageButton type="cover" label="เปลี่ยนปก" />
          </div>
        )}
      </div>

      {/* ── Identity ───────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-end gap-5 px-1 sm:px-4 -mt-14 sm:-mt-16 relative">
        {/* Square avatar — double-framed for a couture, gallery feel */}
        <div className="relative shrink-0">
          <div className={`relative w-28 h-28 sm:w-32 sm:h-32 border-4 border-[var(--bg-primary)] bg-[var(--bg-card)] overflow-hidden ${isVerified ? "outline outline-1 outline-offset-[3px] outline-[var(--text-primary)]/40" : ""}`}>
            {user.avatarUrl ? (
              <Image src={user.avatarUrl} alt={user.username} fill unoptimized className="object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center font-bebas text-5xl tracking-wider text-[var(--text-primary)]">
                {user.username[0]?.toUpperCase()}
              </div>
            )}
            {isOwner && (
              <div className="absolute bottom-1 right-1">
                <ProfileImageButton type="avatar" className="!px-1.5 !py-1.5" />
              </div>
            )}
          </div>
          {/* Verified seal */}
          {isVerified && !isOwner && (
            <span className="absolute -top-1.5 -right-1.5 w-6 h-6 bg-[var(--text-primary)] text-[var(--bg-primary)] flex items-center justify-center">
              <BadgeCheck className="w-3.5 h-3.5" />
            </span>
          )}
        </div>

        <div className="pb-1 min-w-0 flex-1">
          {/* Eyebrow — couture micro-label */}
          <p className="flex items-center gap-2 text-[10px] text-[var(--text-muted)] uppercase tracking-[0.35em] mb-1.5">
            <span className="w-5 h-px bg-[var(--text-muted)]" />
            {eyebrow}
          </p>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <h1 className="font-bebas text-4xl sm:text-5xl text-[var(--text-primary)] tracking-[0.06em] leading-[0.9] uppercase">
              {displayName}
            </h1>
            {isVerified && (
              <BadgeCheck className="w-5 h-5 text-[var(--text-primary)] shrink-0" />
            )}
            <span className={`inline-flex items-center gap-1 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] ${role.chip}`}>
              <RoleIcon className="w-3.5 h-3.5" /> {role.label}
            </span>
          </div>
          <p className="text-xs text-[var(--text-secondary)] mt-2 uppercase tracking-[0.2em]">@{user.username}</p>
          {bio && (
            <p className="text-sm text-[var(--text-secondary)] mt-3 max-w-2xl leading-relaxed">{bio}</p>
          )}
        </div>
      </div>

      {/* ── Stats — editorial hairline strip ───────────────────────── */}
      <div className="mt-8 mb-12 border-y border-[var(--border)] grid grid-cols-2 sm:grid-cols-4 divide-x divide-y sm:divide-y-0 divide-[var(--border)]">
        {stats.map(({ icon: Icon, label, value }) => (
          <div key={label} className="px-4 py-6 text-center">
            <Icon className="w-4 h-4 text-[var(--text-muted)] mx-auto mb-2" />
            <p className="font-bebas text-3xl sm:text-4xl text-[var(--text-primary)] tracking-wider leading-none">{value}</p>
            <p className="text-[10px] text-[var(--text-secondary)] uppercase tracking-[0.25em] mt-2">{label}</p>
          </div>
        ))}
      </div>

      {/* ── Reader rank ────────────────────────────────────────────── */}
      <section className="mb-10">
        <SectionTitle><Trophy className="w-5 h-5" /> ยศนักอ่าน</SectionTitle>
        <div className="flex items-center gap-4 border border-[var(--border)] bg-[var(--bg-surface)] p-5">
          <div className="w-16 h-16 flex items-center justify-center bg-[var(--text-primary)] text-[var(--bg-primary)] shrink-0">
            <RankIcon className="w-8 h-8" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] uppercase tracking-[0.3em] text-[var(--text-muted)]">
              LV.{rank.current.level} · {rank.current.nameEn}
            </p>
            <p className="font-bebas text-2xl text-[var(--text-primary)] tracking-wider">
              {rank.current.name}
            </p>
            {rank.next ? (
              <div className="mt-2">
                <div className="flex justify-between text-[11px] text-[var(--text-secondary)] mb-1">
                  <span className="flex items-center gap-1">
                    ยศถัดไป <ArrowRight className="w-3 h-3" /> {rank.next.name}
                  </span>
                  <span>{rank.percentToNext}%</span>
                </div>
                <div className="h-1.5 w-full bg-[var(--bg-card)] border border-[var(--border)] overflow-hidden">
                  <div className="h-full bg-[var(--text-primary)]" style={{ width: `${rank.percentToNext}%` }} />
                </div>
                <p className="text-[11px] text-[var(--text-muted)] mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-0.5">
                  {rank.readsToNext > 0 && (
                    <span className="flex items-center gap-1">
                      <BookOpen className="w-3 h-3" /> อ่านอีก {rank.readsToNext} ตอน
                    </span>
                  )}
                  {rank.coinsToNext > 0 && (
                    <span className="flex items-center gap-1">
                      <Coins className="w-3 h-3" /> ใช้เหรียญปลดล็อกอีก {rank.coinsToNext}
                    </span>
                  )}
                  {rank.readsToNext === 0 && rank.coinsToNext === 0 && <span>พร้อมเลื่อนยศ!</span>}
                </p>
              </div>
            ) : (
              <p className="text-[11px] text-[var(--text-primary)] mt-2 flex items-center gap-1">
                <Crown className="w-3.5 h-3.5" /> ยศสูงสุดแล้ว
              </p>
            )}
          </div>
        </div>
      </section>

      {/* ── Recent achievements ────────────────────────────────────── */}
      {unlockedAch.length > 0 && (
        <section className="mb-10">
          <SectionTitle><Trophy className="w-5 h-5" /> ความสำเร็จล่าสุด</SectionTitle>
          <div className="flex flex-wrap gap-2">
            {unlockedAch.map((a) => (
              <span
                key={a.key}
                title={a.description}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-[var(--text-primary)]/30 bg-[var(--bg-surface)] text-xs text-[var(--text-primary)]"
              >
                <Trophy className="w-3.5 h-3.5" /> {a.title}
              </span>
            ))}
            {isOwner && (
              <Link
                href="/achievements"
                className="inline-flex items-center gap-1 px-3 py-1.5 border border-[var(--border)] text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--text-primary)]/50 transition-colors"
              >
                ดูทั้งหมด <ArrowRight className="w-3 h-3" />
              </Link>
            )}
          </div>
        </section>
      )}

      {/* ── Get verified (own translator, not yet verified) ────────── */}
      {isOwner && !!user.translator && !isVerified && (
        <div className="mb-10">
          <VerificationCard
            status={
              user.verificationRequest?.status === "PENDING"
                ? "PENDING"
                : user.verificationRequest?.status === "REJECTED"
                ? "REJECTED"
                : "NONE"
            }
            fee={VERIFY_FEE_COINS}
          />
        </div>
      )}

      {/* ── Creator tools (own translator/admin profile only) ──────── */}
      {isOwner && isCreator && (
        <section className="mb-10">
          <SectionTitle>
            <PenTool className="w-5 h-5" /> เครื่องมือนักแปล
          </SectionTitle>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {[
              { href: "/upload", icon: Plus, label: "ลงผลงานใหม่", primary: true },
              { href: "/dashboard", icon: LayoutDashboard, label: "แดชบอร์ด" },
              { href: "/dashboard/earnings", icon: Wallet, label: "รายได้" },
              { href: "/dashboard/withdraw", icon: Banknote, label: "ถอนเงิน" },
              { href: "/settings", icon: Settings, label: "ตั้งค่า" },
            ].map(({ href, icon: Icon, label, primary }) => (
              <Link
                key={href}
                href={href}
                className={`flex flex-col items-center justify-center gap-2 py-5 text-xs font-semibold uppercase tracking-widest transition-colors ${
                  primary
                    ? "bal-btn"
                    : "border border-[var(--border)] bg-[var(--bg-surface)] text-[var(--text-primary)] hover:border-[var(--text-primary)]/50"
                }`}
              >
                <Icon className="w-5 h-5" />
                {label}
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* ── Top Fans (creators only) ───────────────────────────────── */}
      {isCreator && topFans.length > 0 && (
        <section className="mb-10">
          <SectionTitle>
            <Heart className="w-5 h-5" /> TOP FANS
          </SectionTitle>
          <div className="flex gap-3 overflow-x-auto pb-2">
            {topFans.map((fan, i) => (
              <Link
                key={fan.id}
                href={`/profile/${fan.username}`}
                className="group relative w-28 shrink-0 border border-[var(--border)] bg-[var(--bg-surface)] p-3 text-center hover:border-[var(--text-primary)]/50 transition-colors"
              >
                <span className="absolute top-1.5 left-1.5 font-bebas text-sm text-[var(--text-muted)]">#{i + 1}</span>
                <div className="relative w-14 h-14 mx-auto mb-2 border border-[var(--border)] overflow-hidden bg-[var(--bg-card)]">
                  {fan.avatarUrl ? (
                    <Image src={fan.avatarUrl} alt={fan.username} fill unoptimized className="object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-lg font-bold text-[var(--text-primary)]">
                      {fan.username[0]?.toUpperCase()}
                    </div>
                  )}
                </div>
                <p className="text-xs text-[var(--text-primary)] truncate">@{fan.username}</p>
                <p className="flex items-center justify-center gap-1 text-[10px] text-[var(--text-secondary)] mt-0.5">
                  <Coins className="w-3 h-3" /> {fan.coins.toLocaleString()}
                </p>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* ── Works (creators) ───────────────────────────────────────── */}
      {isCreator && works.length > 0 && (
        <section className="mb-10">
          <SectionTitle>ผลงานที่ลง ({works.length})</SectionTitle>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {works.map((manga) => {
              const avgRating =
                manga.ratings.length > 0
                  ? manga.ratings.reduce((a, b) => a + b.score, 0) / manga.ratings.length
                  : 0;
              return (
                <div key={manga.id} className="space-y-1.5">
                  <MangaCard
                    slug={manga.slug}
                    title={manga.title}
                    coverUrl={manga.coverUrl}
                    latestChapter={manga.chapters[0]?.chapterNum}
                    rating={avgRating}
                    status={manga.status}
                    type={manga.type}
                  />
                  {isOwner && (
                    <Link
                      href={`/dashboard/manga/${manga.slug}/chapters`}
                      className="flex items-center justify-center gap-1.5 w-full py-1.5 border border-[var(--border)] text-[10px] font-semibold uppercase tracking-widest text-[var(--text-secondary)] hover:bg-[var(--text-primary)] hover:text-[var(--bg-primary)] hover:border-[var(--text-primary)] transition-colors"
                    >
                      <Settings className="w-3 h-3" /> จัดการ
                    </Link>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* ── Bookmarks ──────────────────────────────────────────────── */}
      {user.bookmarks.length > 0 && (
        <section className="mb-10">
          <SectionTitle>บุ๊กมาร์ก</SectionTitle>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {user.bookmarks.map(({ manga }) => {
              const avgRating =
                manga.ratings.length > 0
                  ? manga.ratings.reduce((a, b) => a + b.score, 0) / manga.ratings.length
                  : 0;
              return (
                <MangaCard
                  key={manga.id}
                  slug={manga.slug}
                  title={manga.title}
                  coverUrl={manga.coverUrl}
                  latestChapter={manga.chapters[0]?.chapterNum}
                  rating={avgRating}
                  status={manga.status}
                  type={manga.type}
                />
              );
            })}
          </div>
        </section>
      )}

      {/* ── Read history ───────────────────────────────────────────── */}
      {user.readHistory.length > 0 && (
        <section>
          <SectionTitle>ประวัติการอ่าน</SectionTitle>
          <div className="space-y-2">
            {user.readHistory.map((h) => (
              <div
                key={`${h.userId}-${h.chapterId}`}
                className="flex items-center gap-4 p-3 bg-[var(--bg-surface)] border border-[var(--border)]"
              >
                <div className="relative w-10 h-14 overflow-hidden bg-[var(--bg-card)] flex-shrink-0">
                  {h.chapter.manga.coverUrl && (
                    <Image src={h.chapter.manga.coverUrl} alt={h.chapter.manga.title} fill unoptimized className="object-cover" sizes="40px" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[var(--text-primary)] line-clamp-1">{h.chapter.manga.title}</p>
                  <p className="text-xs text-[var(--text-primary)]">ตอนที่ {h.chapter.chapterNum}</p>
                </div>
                <p className="text-xs text-[var(--text-secondary)] flex-shrink-0">
                  {new Date(h.readAt).toLocaleDateString("th-TH")}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      {!hasActivity && (
        <div className="text-center py-16 text-[var(--text-secondary)] text-sm">
          ยังไม่มีกิจกรรม
        </div>
      )}
    </div>
  );
}
