"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Eye, BookOpen, Bookmark, Coins, Users, TrendingUp,
  Star, Crown, Lock, MessageSquare, ChevronRight, BarChart2,
  Calendar, ArrowUpRight, Settings,
} from "lucide-react";
import clsx from "clsx";

interface MangaStat {
  id: string;
  title: string;
  slug: string;
  coverUrl: string | null;
  status: string;
  type: string;
  totalViews: number;
  chapterCount: number;
  bookmarkCount: number;
  ratingCount: number;
  avgRating: number;
  unlockCount: number;
  coinsEarned: number;
  createdAt: string;
  genres: string[];
}

interface ChapterStat {
  id: string;
  chapterNum: number;
  title: string | null;
  mangaTitle: string;
  mangaSlug: string;
  isPremium: boolean;
  coinCost: number;
  viewCount: number;
  unlockCount: number;
  coinsEarned: number;
  commentCount: number;
  publishedAt: string;
}

interface UnlockEvent {
  chapterNum: number;
  chapterTitle: string | null;
  mangaTitle: string;
  mangaSlug: string;
  coinSpent: number;
  unlockedAt: string;
}

interface Props {
  translator: { penName: string; bio: string };
  stats: {
    totalViews: number;
    totalChapters: number;
    totalBookmarks: number;
    totalUnlocks: number;
    totalCoins: number;
    recentReaders: number;
    mangaCount: number;
  };
  mangaStats: MangaStat[];
  topChapters: ChapterStat[];
  recentUnlocks: UnlockEvent[];
}

const TABS = [
  { key: "works", label: "ผลงานทั้งหมด", icon: BookOpen },
  { key: "chapters", label: "ตอนยอดนิยม", icon: TrendingUp },
  { key: "revenue", label: "รายรับ", icon: Coins },
] as const;

type Tab = (typeof TABS)[number]["key"];

function StatCard({
  label, value, icon: Icon, color, sub,
}: {
  label: string;
  value: string | number;
  icon: React.ElementType;
  color: string;
  sub?: string;
}) {
  return (
    <div className="bg-[#141720] rounded-2xl border border-white/5 p-5 flex flex-col gap-3">
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${color}`}>
        <Icon className="w-4 h-4 text-white" />
      </div>
      <div>
        <p className="text-2xl font-bold text-white">
          {typeof value === "number" ? value.toLocaleString() : value}
        </p>
        <p className="text-xs text-gray-500 mt-0.5">{label}</p>
        {sub && <p className="text-xs text-gray-600 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

function ViewBar({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? Math.max(2, Math.round((value / max) * 100)) : 2;
  return (
    <div className="flex items-center gap-2 flex-1 min-w-0">
      <div className="flex-1 bg-white/5 rounded-full h-1.5">
        <div
          className="h-1.5 rounded-full bg-gradient-to-r from-[#ff2d55] to-[#ff6b2b]"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs text-gray-400 w-12 text-right shrink-0">
        {value.toLocaleString()}
      </span>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={clsx(
        "text-xs px-2 py-0.5 rounded-full font-medium",
        status === "ONGOING"
          ? "bg-green-500/20 text-green-400"
          : status === "COMPLETED"
          ? "bg-blue-500/20 text-blue-400"
          : "bg-yellow-500/20 text-yellow-400"
      )}
    >
      {status === "ONGOING" ? "กำลังดำเนินเรื่อง" : status === "COMPLETED" ? "จบแล้ว" : status}
    </span>
  );
}

export default function DashboardClient({
  translator, stats, mangaStats, topChapters, recentUnlocks,
}: Props) {
  const [activeTab, setActiveTab] = useState<Tab>("works");

  const maxViews = Math.max(...mangaStats.map((m) => m.totalViews), 1);
  const maxChapterViews = Math.max(...topChapters.map((c) => c.viewCount), 1);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Crown className="w-5 h-5 text-[#ff6b2b]" />
            <span className="text-sm text-[#ff6b2b] font-medium">Creator Dashboard</span>
          </div>
          <h1 className="font-bebas text-4xl text-white tracking-wider">
            {translator.penName}
          </h1>
          {translator.bio && (
            <p className="text-sm text-gray-500 mt-1">{translator.bio}</p>
          )}
        </div>
        <div className="flex gap-2 flex-wrap">
          <Link
            href="/dashboard/earnings"
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-gray-300 text-sm font-medium hover:bg-white/10 transition-colors"
          >
            <Coins className="w-4 h-4 text-yellow-400" />
            รายได้ & ถอนเงิน
          </Link>
          <Link
            href="/upload"
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#ff2d55] to-[#ff6b2b] text-white text-sm font-medium hover:opacity-90 transition-opacity"
          >
            <BookOpen className="w-4 h-4" />
            อัปโหลดผลงานใหม่
          </Link>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatCard
          label="ผลงานทั้งหมด"
          value={stats.mangaCount}
          icon={BookOpen}
          color="bg-[#ff2d55]/80"
        />
        <StatCard
          label="ยอดชมรวม"
          value={stats.totalViews}
          icon={Eye}
          color="bg-[#ff6b2b]/80"
        />
        <StatCard
          label="ตอนทั้งหมด"
          value={stats.totalChapters}
          icon={BarChart2}
          color="bg-purple-500/80"
        />
        <StatCard
          label="บุ๊กมาร์ก"
          value={stats.totalBookmarks}
          icon={Bookmark}
          color="bg-blue-500/80"
        />
        <StatCard
          label="ผู้อ่าน 7 วัน"
          value={stats.recentReaders}
          icon={Users}
          color="bg-green-500/80"
          sub="unique reads"
        />
        <StatCard
          label="เหรียญรับมา"
          value={stats.totalCoins}
          icon={Coins}
          color="bg-yellow-500/80"
          sub={`${stats.totalUnlocks} ครั้งที่ unlock`}
        />
      </div>

      {/* Views by manga — mini chart */}
      {mangaStats.length > 0 && (
        <div className="bg-[#141720] rounded-2xl border border-white/5 p-5">
          <h2 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
            <BarChart2 className="w-4 h-4 text-[#ff6b2b]" />
            ยอดชมแต่ละผลงาน
          </h2>
          <div className="space-y-3">
            {[...mangaStats]
              .sort((a, b) => b.totalViews - a.totalViews)
              .slice(0, 8)
              .map((m) => (
                <div key={m.id} className="flex items-center gap-3 min-w-0">
                  <Link
                    href={`/content/${m.slug}`}
                    className="text-sm text-gray-300 hover:text-white transition-colors truncate w-36 shrink-0"
                  >
                    {m.title}
                  </Link>
                  <ViewBar value={m.totalViews} max={maxViews} />
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div>
        <div className="flex gap-2 mb-6 border-b border-white/5 overflow-x-auto scrollbar-none">
          {TABS.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={clsx(
                "flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-all whitespace-nowrap shrink-0",
                activeTab === key
                  ? "border-[#ff2d55] text-white"
                  : "border-transparent text-gray-500 hover:text-gray-300"
              )}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </div>

        {/* Tab: Works */}
        {activeTab === "works" && (
          <div>
            {mangaStats.length === 0 ? (
              <EmptyState
                label="ยังไม่มีผลงาน"
                sub="เริ่มอัปโหลดผลงานแรกของคุณ"
                href="/upload"
                cta="อัปโหลดเลย"
              />
            ) : (
              <div className="space-y-3">
                {mangaStats.map((m) => (
                  <div
                    key={m.id}
                    className="bg-[#141720] rounded-2xl border border-white/5 p-4 flex gap-4 items-center"
                  >
                    {/* Cover */}
                    {m.coverUrl ? (
                      <img
                        src={m.coverUrl}
                        alt={m.title}
                        className="w-12 h-16 object-cover rounded-lg shrink-0"
                      />
                    ) : (
                      <div className="w-12 h-16 rounded-lg bg-white/5 shrink-0 flex items-center justify-center">
                        <BookOpen className="w-5 h-5 text-gray-600" />
                      </div>
                    )}

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <Link
                          href={`/content/${m.slug}`}
                          className="font-semibold text-white hover:text-[#ff6b2b] transition-colors truncate"
                        >
                          {m.title}
                        </Link>
                        <StatusBadge status={m.status} />
                      </div>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
                        <span className="flex items-center gap-1">
                          <Eye className="w-3 h-3" />
                          {m.totalViews.toLocaleString()} ชม
                        </span>
                        <span className="flex items-center gap-1">
                          <BookOpen className="w-3 h-3" />
                          {m.chapterCount} ตอน
                        </span>
                        <span className="flex items-center gap-1">
                          <Bookmark className="w-3 h-3" />
                          {m.bookmarkCount.toLocaleString()}
                        </span>
                        {m.avgRating > 0 && (
                          <span className="flex items-center gap-1">
                            <Star className="w-3 h-3 text-yellow-400" />
                            {m.avgRating.toFixed(1)}
                          </span>
                        )}
                        {m.unlockCount > 0 && (
                          <span className="flex items-center gap-1 text-yellow-400">
                            <Coins className="w-3 h-3" />
                            {m.coinsEarned.toLocaleString()} เหรียญ
                          </span>
                        )}
                      </div>
                      {m.genres.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {m.genres.slice(0, 3).map((g) => (
                            <span
                              key={g}
                              className="text-xs px-1.5 py-0.5 rounded bg-white/5 text-gray-500"
                            >
                              {g}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <Link
                        href={`/dashboard/manga/${m.slug}/chapters`}
                        title="จัดการตอน (ล็อค/ฟรี, ราคา, จัดเรียงหน้า)"
                        className="p-2 rounded-lg bg-white/5 hover:bg-[#ff6b2b]/20 text-gray-500 hover:text-[#ff6b2b] transition-all"
                      >
                        <Settings className="w-4 h-4" />
                      </Link>
                      <Link
                        href={`/content/${m.slug}`}
                        className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-gray-500 hover:text-white transition-all"
                      >
                        <ArrowUpRight className="w-4 h-4" />
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab: Top chapters */}
        {activeTab === "chapters" && (
          <div>
            {topChapters.length === 0 ? (
              <EmptyState
                label="ยังไม่มีตอน"
                sub="อัปโหลดตอนแรกเพื่อดูสถิติ"
                href="/upload"
                cta="อัปโหลดเลย"
              />
            ) : (
              <div className="bg-[#141720] rounded-2xl border border-white/5 overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs text-gray-500 border-b border-white/5">
                      <th className="text-left px-4 py-3 font-medium">#</th>
                      <th className="text-left px-4 py-3 font-medium">ผลงาน / ตอน</th>
                      <th className="text-left px-4 py-3 font-medium hidden sm:table-cell">ยอดชม</th>
                      <th className="text-left px-4 py-3 font-medium hidden md:table-cell">ความคิดเห็น</th>
                      <th className="text-left px-4 py-3 font-medium">Unlock</th>
                      <th className="text-left px-4 py-3 font-medium hidden sm:table-cell">วันที่</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {topChapters.map((ch, i) => (
                      <tr key={ch.id} className="hover:bg-white/5 transition-colors">
                        <td className="px-4 py-3 text-gray-600 text-xs w-8">
                          {i + 1}
                        </td>
                        <td className="px-4 py-3">
                          <Link
                            href={`/content/${ch.mangaSlug}`}
                            className="text-xs text-gray-500 hover:text-gray-300 transition-colors block"
                          >
                            {ch.mangaTitle}
                          </Link>
                          <span className="text-white font-medium">
                            ตอนที่ {ch.chapterNum}
                            {ch.title && (
                              <span className="text-gray-400 font-normal ml-1">
                                · {ch.title}
                              </span>
                            )}
                          </span>
                          {ch.isPremium && (
                            <span className="ml-2 inline-flex items-center gap-0.5 text-xs text-yellow-400">
                              <Lock className="w-2.5 h-2.5" />
                              {ch.coinCost}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 hidden sm:table-cell">
                          <div className="flex items-center gap-2">
                            <ViewBar value={ch.viewCount} max={maxChapterViews} />
                          </div>
                        </td>
                        <td className="px-4 py-3 hidden md:table-cell">
                          <span className="flex items-center gap-1 text-gray-400">
                            <MessageSquare className="w-3 h-3" />
                            {ch.commentCount}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {ch.unlockCount > 0 ? (
                            <span className="flex items-center gap-1 text-yellow-400 text-xs">
                              <Coins className="w-3 h-3" />
                              {ch.coinsEarned}
                            </span>
                          ) : (
                            <span className="text-gray-600 text-xs">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3 hidden sm:table-cell text-gray-600 text-xs">
                          {new Date(ch.publishedAt).toLocaleDateString("th-TH")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Tab: Revenue */}
        {activeTab === "revenue" && (
          <div className="space-y-4">
            {/* Revenue summary */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-[#141720] rounded-2xl border border-white/5 p-5">
                <p className="text-xs text-gray-500 mb-1">เหรียญทั้งหมดที่รับมา</p>
                <p className="text-3xl font-bold text-yellow-400">
                  {stats.totalCoins.toLocaleString()}
                </p>
                <p className="text-xs text-gray-600 mt-1">จาก {stats.totalUnlocks} ครั้ง unlock</p>
              </div>
              <div className="bg-[#141720] rounded-2xl border border-white/5 p-5">
                <p className="text-xs text-gray-500 mb-1">รายรับเฉลี่ยต่อ unlock</p>
                <p className="text-3xl font-bold text-white">
                  {stats.totalUnlocks > 0
                    ? (stats.totalCoins / stats.totalUnlocks).toFixed(1)
                    : "0"}
                </p>
                <p className="text-xs text-gray-600 mt-1">เหรียญ / ครั้ง</p>
              </div>
            </div>

            {/* Revenue by manga */}
            {mangaStats.some((m) => m.coinsEarned > 0) && (
              <div className="bg-[#141720] rounded-2xl border border-white/5 p-5">
                <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-[#ff6b2b]" />
                  รายรับแยกตามผลงาน
                </h3>
                <div className="space-y-3">
                  {[...mangaStats]
                    .filter((m) => m.coinsEarned > 0)
                    .sort((a, b) => b.coinsEarned - a.coinsEarned)
                    .map((m) => {
                      const maxCoins = Math.max(
                        ...mangaStats.map((x) => x.coinsEarned),
                        1
                      );
                      const pct = Math.max(
                        2,
                        Math.round((m.coinsEarned / maxCoins) * 100)
                      );
                      return (
                        <div key={m.id} className="flex items-center gap-3 min-w-0">
                          <Link
                            href={`/content/${m.slug}`}
                            className="text-sm text-gray-300 hover:text-white transition-colors truncate w-36 shrink-0"
                          >
                            {m.title}
                          </Link>
                          <div className="flex-1 bg-white/5 rounded-full h-1.5">
                            <div
                              className="h-1.5 rounded-full bg-gradient-to-r from-yellow-500 to-orange-400"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span className="text-xs text-yellow-400 w-20 text-right shrink-0">
                            <Coins className="w-3 h-3 inline mr-0.5" />
                            {m.coinsEarned.toLocaleString()}
                          </span>
                        </div>
                      );
                    })}
                </div>
              </div>
            )}

            {/* Recent unlock feed */}
            <div className="bg-[#141720] rounded-2xl border border-white/5 overflow-hidden">
              <div className="px-5 py-4 border-b border-white/5">
                <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-[#ff6b2b]" />
                  รายการ Unlock ล่าสุด
                </h3>
              </div>
              {recentUnlocks.length === 0 ? (
                <div className="py-12 text-center text-gray-600 text-sm">
                  ยังไม่มีรายการ unlock
                </div>
              ) : (
                <div className="divide-y divide-white/5">
                  {recentUnlocks.map((u, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between px-5 py-3 hover:bg-white/5 transition-colors"
                    >
                      <div className="min-w-0">
                        <p className="text-sm text-white truncate">
                          {u.mangaTitle}{" "}
                          <span className="text-gray-500">ตอน {u.chapterNum}</span>
                        </p>
                        {u.chapterTitle && (
                          <p className="text-xs text-gray-600 truncate">{u.chapterTitle}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-4 shrink-0 ml-4">
                        <span className="text-yellow-400 text-sm font-medium flex items-center gap-1">
                          <Coins className="w-3.5 h-3.5" />
                          {u.coinSpent}
                        </span>
                        <span className="text-xs text-gray-600">
                          {new Date(u.unlockedAt).toLocaleDateString("th-TH")}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function EmptyState({
  label, sub, href, cta,
}: {
  label: string;
  sub: string;
  href: string;
  cta: string;
}) {
  return (
    <div className="text-center py-16">
      <BookOpen className="w-10 h-10 mx-auto mb-3 text-gray-700" />
      <p className="text-white font-medium mb-1">{label}</p>
      <p className="text-sm text-gray-500 mb-4">{sub}</p>
      <Link
        href={href}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-[#ff2d55] to-[#ff6b2b] text-white text-sm font-medium hover:opacity-90 transition-opacity"
      >
        {cta}
        <ChevronRight className="w-4 h-4" />
      </Link>
    </div>
  );
}
