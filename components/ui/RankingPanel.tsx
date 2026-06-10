"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { TrendingUp, Flame, Clock } from "lucide-react";
import clsx from "clsx";

interface RankItem {
  rank: number;
  mangaId: string;
  manga: {
    title: string;
    slug: string;
    coverUrl?: string | null;
    type: string;
  };
  views: number;
}

interface RankingPanelProps {
  weeklyData?: RankItem[];
  monthlyData?: RankItem[];
  allTimeData?: RankItem[];
}

const tabs = [
  { key: "WEEK", label: "สัปดาห์", icon: Flame },
  { key: "MONTH", label: "เดือน", icon: TrendingUp },
  { key: "ALL", label: "ทั้งหมด", icon: Clock },
] as const;

export default function RankingPanel({
  weeklyData = [],
  monthlyData = [],
  allTimeData = [],
}: RankingPanelProps) {
  const [activeTab, setActiveTab] = useState<"WEEK" | "MONTH" | "ALL">("WEEK");

  const data =
    activeTab === "WEEK"
      ? weeklyData
      : activeTab === "MONTH"
      ? monthlyData
      : allTimeData;

  return (
    <div className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border)] overflow-hidden">
      <div className="p-4 border-b border-[var(--border)]">
        <h3 className="font-bebas text-xl text-[var(--text-primary)] tracking-wider flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-[var(--text-primary)]" />
          อันดับ
        </h3>
        <div className="flex gap-1 mt-3">
          {tabs.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={clsx(
                "flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-xs font-medium transition-all",
                activeTab === key
                  ? "bg-[var(--accent)] text-[var(--text-primary)]"
                  : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-white/5"
              )}
            >
              <Icon className="w-3 h-3" />
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="divide-y divide-white/5">
        {data.length === 0 ? (
          <div className="p-8 text-center text-[var(--text-secondary)] text-sm">
            ยังไม่มีข้อมูล
          </div>
        ) : (
          data.slice(0, 10).map((item, i) => (
            <Link
              key={item.mangaId}
              href={`/content/${item.manga.slug}`}
              className="flex items-center gap-3 p-3 hover:bg-white/5 transition-colors"
            >
              <span
                className={clsx(
                  "w-7 h-7 flex items-center justify-center rounded-lg text-sm font-bold flex-shrink-0",
                  i === 0
                    ? "bg-gradient-to-br from-yellow-400 to-yellow-600 text-black"
                    : i === 1
                    ? "bg-gradient-to-br from-gray-300 to-gray-500 text-black"
                    : i === 2
                    ? "bg-gradient-to-br from-orange-400 to-orange-700 text-black"
                    : "bg-white/10 text-[var(--text-secondary)]"
                )}
              >
                {i + 1}
              </span>

              <div className="relative w-10 h-13 flex-shrink-0 rounded overflow-hidden bg-[var(--bg-card)]">
                {item.manga.coverUrl ? (
                  <Image
                    src={item.manga.coverUrl}
                    alt={item.manga.title}
                    fill
                    unoptimized
                    className="object-cover"
                    sizes="40px"
                  />
                ) : (
                  <div className="w-full h-full bg-[var(--bg-card)]" />
                )}
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-sm text-[var(--text-primary)] font-medium line-clamp-1">
                  {item.manga.title}
                </p>
                <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                  {item.views >= 1000
                    ? `${(item.views / 1000).toFixed(1)}k`
                    : item.views}{" "}
                  views
                </p>
              </div>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
