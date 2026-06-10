import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import Image from "next/image";
import MangaCard from "@/components/ui/MangaCard";
import {
  BookMarked, History, Star, Calendar, Eye, Layers,
  Shield, PenTool, User as UserIcon, BookOpen,
} from "lucide-react";
import type { Metadata } from "next";

interface Props {
  params: Promise<{ username: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { username } = await params;
  return { title: `โปรไฟล์ ${username}` };
}

const ROLES = {
  READER: {
    label: "นักอ่าน",
    icon: UserIcon,
    chip: "bg-[var(--bg-card)] text-[var(--text-secondary)] border border-[var(--border)]",
    ring: "ring-[var(--border)]",
  },
  TRANSLATOR: {
    label: "นักแปล",
    icon: PenTool,
    chip: "bg-[var(--accent)] text-white",
    ring: "ring-[var(--text-primary)]",
  },
  ADMIN: {
    label: "ผู้ดูแลระบบ",
    icon: Shield,
    chip: "bg-gradient-to-r from-[var(--accent)] to-[#b91c47] text-white",
    ring: "ring-[var(--text-primary)]",
  },
} as const;

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="font-bebas text-2xl text-[var(--text-primary)] tracking-wider mb-4 flex items-center gap-2">
      <span className="w-1 h-6 bg-[var(--accent)] rounded-full" />
      {children}
    </h2>
  );
}

export default async function ProfilePage({ params }: Props) {
  const { username } = await params;

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

  const role = ROLES[user.role as keyof typeof ROLES] ?? ROLES.READER;
  const RoleIcon = role.icon;

  const works = user.translator?.mangas ?? [];
  const isCreator = !!user.translator && works.length > 0;
  const totalViews = works.reduce((s, m) => s + m.totalViews, 0);
  const totalChapters = works.reduce((s, m) => s + m._count.chapters, 0);
  const displayName = user.translator?.penName || user.username;
  const joined = new Date(user.createdAt).toLocaleDateString("th-TH", { year: "numeric", month: "short" });

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

  const hasActivity = isCreator || user.bookmarks.length > 0 || user.readHistory.length > 0;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      {/* Header */}
      <div className="relative mb-8">
        <div className="h-36 rounded-2xl bg-gradient-to-r from-[var(--accent)]/25 via-[var(--bg-card)] to-[var(--accent)]/25 border border-[var(--border)]" />
        <div className="flex flex-col sm:flex-row sm:items-end gap-4 px-4 sm:px-6 -mt-12">
          <div className={`relative w-24 h-24 rounded-full overflow-hidden ring-4 ${role.ring} border-4 border-[var(--bg-primary)] bg-[var(--bg-card)] shrink-0`}>
            {user.avatarUrl ? (
              <Image src={user.avatarUrl} alt={user.username} fill className="object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-3xl font-bold text-white bg-[var(--accent)]">
                {user.username[0]?.toUpperCase()}
              </div>
            )}
          </div>
          <div className="pb-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="font-bebas text-3xl text-[var(--text-primary)] tracking-wider leading-none">
                {displayName}
              </h1>
              <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${role.chip}`}>
                <RoleIcon className="w-3.5 h-3.5" /> {role.label}
              </span>
            </div>
            <p className="text-sm text-[var(--text-secondary)] mt-1">@{user.username}</p>
            {user.translator?.bio && (
              <p className="text-sm text-[var(--text-secondary)] mt-2 max-w-2xl leading-relaxed">{user.translator.bio}</p>
            )}
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-10">
        {stats.map(({ icon: Icon, label, value }) => (
          <div key={label} className="bg-[var(--bg-surface)] rounded-xl p-4 border border-[var(--border)] text-center">
            <Icon className="w-5 h-5 text-[var(--text-primary)] mx-auto mb-1.5" />
            <p className="text-xl font-bold text-[var(--text-primary)]">{value}</p>
            <p className="text-xs text-[var(--text-secondary)]">{label}</p>
          </div>
        ))}
      </div>

      {/* Translator / admin channel — uploaded works */}
      {isCreator && (
        <section className="mb-10">
          <SectionTitle>ผลงานที่ลง ({works.length})</SectionTitle>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {works.map((manga) => {
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

      {/* Bookmarks */}
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

      {/* Read history */}
      {user.readHistory.length > 0 && (
        <section>
          <SectionTitle>ประวัติการอ่าน</SectionTitle>
          <div className="space-y-2">
            {user.readHistory.map((h) => (
              <div
                key={`${h.userId}-${h.chapterId}`}
                className="flex items-center gap-4 p-3 bg-[var(--bg-surface)] rounded-xl border border-[var(--border)]"
              >
                <div className="relative w-10 h-14 rounded-lg overflow-hidden bg-[var(--bg-card)] flex-shrink-0">
                  {h.chapter.manga.coverUrl && (
                    <Image src={h.chapter.manga.coverUrl} alt={h.chapter.manga.title} fill className="object-cover" sizes="40px" />
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

      {/* Empty state */}
      {!hasActivity && (
        <div className="text-center py-16 text-[var(--text-secondary)] text-sm">
          ยังไม่มีกิจกรรม
        </div>
      )}
    </div>
  );
}
