"use client";

import { useState } from "react";
import Link from "next/link";
import { Eye, Lock, Unlock } from "lucide-react";
import UnlockModal from "./UnlockModal";

interface ChapterRowProps {
  id: string;
  chapterNum: number;
  title?: string | null;
  isPremium: boolean;
  coinCost: number;
  publishedAt: string;
  viewCount: number;
  isUnlocked: boolean;
  mangaSlug: string;
  userCoins: number;
  isLoggedIn: boolean;
}

export default function ChapterRow({
  id,
  chapterNum,
  title,
  isPremium,
  coinCost,
  publishedAt,
  viewCount,
  isUnlocked,
  mangaSlug,
  userCoins,
  isLoggedIn,
}: ChapterRowProps) {
  const [showModal, setShowModal] = useState(false);

  const canRead = !isPremium || isUnlocked;
  const href = `/content/${mangaSlug}/${chapterNum}`;

  function handleClick(e: React.MouseEvent) {
    if (!canRead) {
      e.preventDefault();
      if (!isLoggedIn) {
        window.location.href = `/auth/signin?callbackUrl=${encodeURIComponent(href)}`;
        return;
      }
      setShowModal(true);
    }
  }

  return (
    <>
      <Link
        href={href}
        onClick={handleClick}
        className="flex items-center justify-between px-4 py-3 rounded-xl bg-[var(--bg-surface)] border border-[var(--border)] hover:border-[var(--text-primary)]/30 hover:bg-[var(--bg-card)] transition-all group"
      >
        <div className="flex items-center gap-3">
          {isPremium ? (
            isUnlocked ? (
              <Unlock className="w-4 h-4 text-green-400 flex-shrink-0" />
            ) : (
              <Lock className="w-4 h-4 text-yellow-400 flex-shrink-0" />
            )
          ) : null}

          <span className="text-sm font-medium text-[var(--text-primary)] group-hover:text-[var(--text-primary)] transition-colors">
            ตอนที่ {chapterNum}
            {title && (
              <span className="text-[var(--text-secondary)] font-normal ml-2">— {title}</span>
            )}
          </span>

          {isPremium && !isUnlocked && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 flex-shrink-0">
              {coinCost} เหรียญ
            </span>
          )}
          {isPremium && isUnlocked && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-500/20 text-green-400 border border-green-500/30 flex-shrink-0">
              ปลดล็อกแล้ว
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
          <span>{new Date(publishedAt).toLocaleDateString("th-TH")}</span>
          <Eye className="w-3.5 h-3.5" />
          <span>{viewCount}</span>
        </div>
      </Link>

      {showModal && (
        <UnlockModal
          chapterId={id}
          chapterNum={chapterNum}
          coinCost={coinCost}
          userCoins={userCoins}
          mangaSlug={mangaSlug}
          onClose={() => setShowModal(false)}
        />
      )}
    </>
  );
}
