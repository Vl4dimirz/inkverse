"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Lock, Unlock, Coins, ArrowUpDown, Check, X, Loader2,
  ChevronRight, GripVertical, Edit3,
} from "lucide-react";
import clsx from "clsx";

interface Chapter {
  id: string;
  chapterNum: number;
  title: string | null;
  isPremium: boolean;
  coinCost: number;
  viewCount: number;
  pageCount: number;
  publishedAt: string;
}

function ChapterRow({
  chapter,
  onUpdated,
}: {
  chapter: Chapter;
  onUpdated: (updated: Chapter) => void;
}) {
  const [editingPrice, setEditingPrice] = useState(false);
  const [priceInput, setPriceInput] = useState(String(chapter.coinCost || 2));
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleInput, setTitleInput] = useState(chapter.title ?? "");
  const [loading, setLoading] = useState(false);

  async function patchChapter(data: Partial<Chapter>) {
    setLoading(true);
    try {
      const res = await fetch(`/api/chapters/${chapter.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (res.ok) {
        const updated = await res.json() as Chapter;
        onUpdated({ ...chapter, ...updated });
      }
    } finally {
      setLoading(false);
    }
  }

  async function toggleLock() {
    const next = !chapter.isPremium;
    await patchChapter({
      isPremium: next,
      coinCost: next ? parseInt(priceInput) || 2 : 0,
    });
  }

  async function savePrice() {
    const price = parseInt(priceInput);
    if (!price || price < 1) { setPriceInput(String(chapter.coinCost || 2)); setEditingPrice(false); return; }
    await patchChapter({ isPremium: true, coinCost: price });
    setEditingPrice(false);
  }

  async function saveTitle() {
    await patchChapter({ title: titleInput.trim() || undefined });
    setEditingTitle(false);
  }

  return (
    <div className={clsx(
      "flex items-center gap-3 px-4 py-3 rounded-xl border transition-all",
      chapter.isPremium
        ? "bg-yellow-500/5 border-yellow-500/20 hover:border-yellow-500/40"
        : "bg-[#1a1e2a] border-white/5 hover:border-white/10"
    )}>
      {/* Drag handle hint */}
      <GripVertical className="w-4 h-4 text-gray-700 shrink-0" />

      {/* Chapter num */}
      <span className="text-sm font-mono text-gray-500 w-8 shrink-0">
        {chapter.chapterNum}
      </span>

      {/* Title */}
      <div className="flex-1 min-w-0">
        {editingTitle ? (
          <div className="flex items-center gap-2">
            <input
              autoFocus
              value={titleInput}
              onChange={(e) => setTitleInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") saveTitle(); if (e.key === "Escape") setEditingTitle(false); }}
              className="flex-1 bg-[#141720] border border-white/20 rounded-lg px-2 py-1 text-sm text-white focus:outline-none focus:border-[#ff2d55]/50"
              placeholder="ชื่อตอน..."
            />
            <button onClick={saveTitle} disabled={loading} className="p-1 text-green-400 hover:text-green-300">
              {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
            </button>
            <button onClick={() => setEditingTitle(false)} className="p-1 text-gray-500 hover:text-white">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 group">
            <span className="text-sm text-white truncate">
              {chapter.title || <span className="text-gray-600 italic">ไม่มีชื่อตอน</span>}
            </span>
            <button
              onClick={() => setEditingTitle(true)}
              className="opacity-0 group-hover:opacity-100 p-0.5 text-gray-600 hover:text-white transition-opacity"
            >
              <Edit3 className="w-3 h-3" />
            </button>
          </div>
        )}
        <div className="flex items-center gap-3 text-xs text-gray-600 mt-0.5">
          <span>{chapter.pageCount} หน้า</span>
          <span>{chapter.viewCount.toLocaleString()} ชม</span>
        </div>
      </div>

      {/* Lock / Price control */}
      <div className="flex items-center gap-2 shrink-0">
        {chapter.isPremium && (
          <>
            {editingPrice ? (
              <div className="flex items-center gap-1">
                <input
                  autoFocus
                  type="number"
                  min={1}
                  max={999}
                  value={priceInput}
                  onChange={(e) => setPriceInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") savePrice(); if (e.key === "Escape") setEditingPrice(false); }}
                  className="w-16 bg-[#141720] border border-yellow-500/30 rounded-lg px-2 py-1 text-sm text-yellow-400 text-center focus:outline-none"
                />
                <button onClick={savePrice} disabled={loading} className="p-1 text-green-400">
                  {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                </button>
                <button onClick={() => setEditingPrice(false)} className="p-1 text-gray-500">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setEditingPrice(true)}
                className="flex items-center gap-1 px-2 py-1 rounded-lg bg-yellow-500/10 text-yellow-400 text-xs font-medium hover:bg-yellow-500/20 transition-colors"
              >
                <Coins className="w-3 h-3" />
                {chapter.coinCost} เหรียญ
                <Edit3 className="w-2.5 h-2.5 text-yellow-600" />
              </button>
            )}
          </>
        )}

        {/* Toggle lock */}
        <button
          onClick={toggleLock}
          disabled={loading}
          title={chapter.isPremium ? "คลิกเพื่อเปิดฟรี" : "คลิกเพื่อล็อค"}
          className={clsx(
            "flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all border",
            chapter.isPremium
              ? "bg-yellow-500/20 border-yellow-500/30 text-yellow-400 hover:bg-red-500/20 hover:border-red-500/30 hover:text-red-400"
              : "bg-white/5 border-white/10 text-gray-500 hover:bg-green-500/10 hover:border-green-500/30 hover:text-green-400"
          )}
        >
          {loading
            ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
            : chapter.isPremium
            ? <Lock className="w-3.5 h-3.5" />
            : <Unlock className="w-3.5 h-3.5" />}
          {chapter.isPremium ? "ล็อค" : "ฟรี"}
        </button>

        {/* Reorder pages link */}
        <Link
          href={`/dashboard/chapters/${chapter.id}/reorder`}
          title="จัดเรียงหน้า"
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs text-gray-500 bg-white/5 border border-white/10 hover:bg-white/10 hover:text-white transition-all"
        >
          <ArrowUpDown className="w-3.5 h-3.5" />
          หน้า
        </Link>
      </div>
    </div>
  );
}

export default function ChapterManager({
  mangaTitle,
  mangaSlug,
  initialChapters,
}: {
  mangaTitle: string;
  mangaSlug: string;
  initialChapters: Chapter[];
}) {
  const [chapters, setChapters] = useState(initialChapters);
  const router = useRouter();

  const premiumCount = chapters.filter((c) => c.isPremium).length;
  const freeCount = chapters.length - premiumCount;

  return (
    <div className="space-y-5">
      {/* Summary */}
      <div className="flex gap-3 flex-wrap">
        <div className="bg-[#141720] rounded-xl border border-white/5 px-4 py-2.5 flex items-center gap-2">
          <Unlock className="w-3.5 h-3.5 text-green-400" />
          <span className="text-sm text-white font-medium">{freeCount}</span>
          <span className="text-xs text-gray-500">ตอนฟรี</span>
        </div>
        <div className="bg-[#141720] rounded-xl border border-yellow-500/20 px-4 py-2.5 flex items-center gap-2">
          <Lock className="w-3.5 h-3.5 text-yellow-400" />
          <span className="text-sm text-white font-medium">{premiumCount}</span>
          <span className="text-xs text-gray-500">ตอนล็อค</span>
        </div>
      </div>

      {/* Chapter list */}
      {chapters.length === 0 ? (
        <div className="text-center py-16 text-gray-600 text-sm">
          ยังไม่มีตอน — <Link href="/upload" className="text-[#ff6b2b] hover:underline">อัปโหลดตอนแรก</Link>
        </div>
      ) : (
        <div className="space-y-2">
          {[...chapters].sort((a, b) => a.chapterNum - b.chapterNum).map((ch) => (
            <ChapterRow
              key={ch.id}
              chapter={ch}
              onUpdated={(updated) =>
                setChapters((prev) => prev.map((c) => (c.id === updated.id ? updated : c)))
              }
            />
          ))}
        </div>
      )}

      <p className="text-xs text-gray-600 text-center">
        คลิก "ล็อค/ฟรี" เพื่อสลับสถานะ · คลิกราคาเพื่อแก้ไข · "หน้า" เพื่อจัดเรียงหน้า
      </p>
    </div>
  );
}
