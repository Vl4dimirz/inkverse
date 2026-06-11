"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Lock, Unlock, Coins, ArrowUpDown, Check, X, Loader2,
  ChevronRight, GripVertical, Edit3, Trash2,
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
  wordCount?: number;
  status?: string;
  scheduledAt?: string | null;
  publishedAt: string;
}

function ChapterRow({
  chapter,
  onUpdated,
  onDeleted,
  isNovel,
  mangaSlug,
}: {
  chapter: Chapter;
  onUpdated: (updated: Chapter) => void;
  onDeleted: (id: string) => void;
  isNovel: boolean;
  mangaSlug: string;
}) {
  const [editingPrice, setEditingPrice] = useState(false);
  const [priceInput, setPriceInput] = useState(String(chapter.coinCost || 2));
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleInput, setTitleInput] = useState(chapter.title ?? "");
  const [editingNum, setEditingNum] = useState(false);
  const [numInput, setNumInput] = useState(String(chapter.chapterNum));
  const [numError, setNumError] = useState("");
  const [loading, setLoading] = useState(false);

  async function patchChapter(data: Partial<Chapter>): Promise<{ ok: boolean; error?: string }> {
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
        return { ok: true };
      }
      const d = await res.json().catch(() => ({} as { error?: string }));
      return { ok: false, error: d.error || "บันทึกไม่สำเร็จ" };
    } finally {
      setLoading(false);
    }
  }

  async function saveNum() {
    const n = parseFloat(numInput);
    if (!Number.isFinite(n) || n < 0) { setNumError("เลขไม่ถูกต้อง"); return; }
    if (n === chapter.chapterNum) { setEditingNum(false); setNumError(""); return; }
    const r = await patchChapter({ chapterNum: n });
    if (r.ok) { setEditingNum(false); setNumError(""); }
    else setNumError(r.error || "หมายเลขซ้ำ");
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

  async function deleteChapter() {
    if (!confirm(`ลบตอนที่ ${chapter.chapterNum}${chapter.title ? ` "${chapter.title}"` : ""}?\n\nหน้าทั้งหมด ${chapter.pageCount} หน้าจะถูกลบถาวร และย้อนกลับไม่ได้`)) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/chapters/${chapter.id}`, { method: "DELETE" });
      if (res.ok) onDeleted(chapter.id);
      else alert("ลบไม่สำเร็จ กรุณาลองใหม่");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={clsx(
      "flex items-center gap-3 px-4 py-3 rounded-xl border transition-all",
      chapter.isPremium
        ? "bg-[var(--bg-card)] border-[var(--border)] hover:border-[var(--text-primary)]"
        : "bg-[var(--bg-card)] border-[var(--border)] hover:border-[var(--border)]"
    )}>
      {/* Drag handle hint */}
      <GripVertical className="w-4 h-4 text-gray-700 shrink-0" />

      {/* Chapter num (editable) */}
      {editingNum ? (
        <div className="flex items-center gap-1 shrink-0">
          <input
            autoFocus
            type="number"
            min={0}
            step={0.1}
            value={numInput}
            onChange={(e) => { setNumInput(e.target.value); setNumError(""); }}
            onKeyDown={(e) => { if (e.key === "Enter") saveNum(); if (e.key === "Escape") { setEditingNum(false); setNumError(""); } }}
            className="w-16 bg-[var(--bg-surface)] border border-white/20 rounded-lg px-2 py-1 text-sm text-[var(--text-primary)] text-center font-mono focus:outline-none focus:border-[var(--text-primary)]/50"
            title={numError || "หมายเลขตอน"}
          />
          <button onClick={saveNum} disabled={loading} className="p-1 text-[var(--text-primary)]">
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
          </button>
          <button onClick={() => { setEditingNum(false); setNumError(""); setNumInput(String(chapter.chapterNum)); }} className="p-1 text-[var(--text-secondary)]">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ) : (
        <button
          onClick={() => setEditingNum(true)}
          title="แก้หมายเลขตอน"
          className="group/num flex items-center gap-0.5 w-10 shrink-0 text-left"
        >
          <span className="text-sm font-mono text-[var(--text-secondary)]">{chapter.chapterNum}</span>
          <Edit3 className="w-2.5 h-2.5 text-[var(--text-muted)] opacity-0 group-hover/num:opacity-100 transition-opacity" />
        </button>
      )}

      {/* Title */}
      <div className="flex-1 min-w-0">
        {editingTitle ? (
          <div className="flex items-center gap-2">
            <input
              autoFocus
              value={titleInput}
              onChange={(e) => setTitleInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") saveTitle(); if (e.key === "Escape") setEditingTitle(false); }}
              className="flex-1 bg-[var(--bg-surface)] border border-white/20 rounded-lg px-2 py-1 text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--text-primary)]/50"
              placeholder="ชื่อตอน..."
            />
            <button onClick={saveTitle} disabled={loading} className="p-1 text-[var(--text-primary)] hover:text-[var(--text-primary)]">
              {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
            </button>
            <button onClick={() => setEditingTitle(false)} className="p-1 text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 group">
            <span className="text-sm text-[var(--text-primary)] truncate">
              {chapter.title || <span className="text-[var(--text-muted)] italic">ไม่มีชื่อตอน</span>}
            </span>
            <button
              onClick={() => setEditingTitle(true)}
              className="opacity-0 group-hover:opacity-100 p-0.5 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
            >
              <Edit3 className="w-3 h-3" />
            </button>
            {chapter.status === "DRAFT" && (
              <span className="text-[9px] px-1.5 py-0.5 border border-[var(--border)] text-[var(--text-secondary)] uppercase tracking-wide shrink-0">ร่าง</span>
            )}
            {chapter.status !== "DRAFT" && chapter.scheduledAt && new Date(chapter.scheduledAt).getTime() > Date.now() && (
              <span className="text-[9px] px-1.5 py-0.5 border border-[var(--border)] text-[var(--text-secondary)] uppercase tracking-wide shrink-0">ตั้งเวลา</span>
            )}
          </div>
        )}
        <div className="flex items-center gap-3 text-xs text-[var(--text-muted)] mt-0.5">
          <span>{isNovel ? `${(chapter.wordCount ?? 0).toLocaleString()} คำ` : `${chapter.pageCount} หน้า`}</span>
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
                  className="w-16 bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg px-2 py-1 text-sm text-[var(--text-primary)] text-center focus:outline-none"
                />
                <button onClick={savePrice} disabled={loading} className="p-1 text-[var(--text-primary)]">
                  {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                </button>
                <button onClick={() => setEditingPrice(false)} className="p-1 text-[var(--text-secondary)]">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setEditingPrice(true)}
                className="flex items-center gap-1 px-2 py-1 rounded-lg bg-[var(--bg-card)] text-[var(--text-primary)] text-xs font-medium hover:bg-[var(--bg-surface)] transition-colors"
              >
                <Coins className="w-3 h-3" />
                {chapter.coinCost} เหรียญ
                <Edit3 className="w-2.5 h-2.5 text-[var(--text-primary)]" />
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
              ? "bg-[var(--bg-card)] border-[var(--border)] text-[var(--text-primary)] hover:bg-[var(--bg-surface)] hover:border-[var(--text-primary)] hover:text-[var(--text-primary)]"
              : "bg-white/5 border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--bg-surface)] hover:border-[var(--text-primary)] hover:text-[var(--text-primary)]"
          )}
        >
          {loading
            ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
            : chapter.isPremium
            ? <Lock className="w-3.5 h-3.5" />
            : <Unlock className="w-3.5 h-3.5" />}
          {chapter.isPremium ? "ล็อค" : "ฟรี"}
        </button>

        {/* Reorder pages (manga) / edit text (novel) */}
        {isNovel ? (
          <Link
            href={`/dashboard/manga/${mangaSlug}/write?ch=${chapter.id}`}
            title="แก้ไขเนื้อหา"
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs text-[var(--text-secondary)] bg-white/5 border border-[var(--border)] hover:bg-white/10 hover:text-[var(--text-primary)] transition-all"
          >
            <Edit3 className="w-3.5 h-3.5" />
            แก้ไข
          </Link>
        ) : (
          <Link
            href={`/dashboard/chapters/${chapter.id}/reorder`}
            title="จัดเรียงหน้า"
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs text-[var(--text-secondary)] bg-white/5 border border-[var(--border)] hover:bg-white/10 hover:text-[var(--text-primary)] transition-all"
          >
            <ArrowUpDown className="w-3.5 h-3.5" />
            หน้า
          </Link>
        )}

        {/* Delete chapter */}
        <button
          onClick={deleteChapter}
          disabled={loading}
          title="ลบตอนนี้"
          className="flex items-center justify-center w-8 h-8 rounded-xl text-[var(--text-secondary)] bg-white/5 border border-[var(--border)] hover:bg-[var(--bg-surface)] hover:border-[var(--text-primary)] hover:text-[var(--text-primary)] transition-all"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

export default function ChapterManager({
  mangaTitle,
  mangaSlug,
  mangaType = "MANGA",
  initialChapters,
}: {
  mangaTitle: string;
  mangaSlug: string;
  mangaType?: string;
  initialChapters: Chapter[];
}) {
  const [chapters, setChapters] = useState(initialChapters);
  const router = useRouter();
  const isNovel = mangaType === "NOVEL";

  const premiumCount = chapters.filter((c) => c.isPremium).length;
  const freeCount = chapters.length - premiumCount;

  return (
    <div className="space-y-5">
      {/* Summary */}
      <div className="flex gap-3 flex-wrap">
        <div className="bg-[var(--bg-surface)] rounded-xl border border-[var(--border)] px-4 py-2.5 flex items-center gap-2">
          <Unlock className="w-3.5 h-3.5 text-[var(--text-primary)]" />
          <span className="text-sm text-[var(--text-primary)] font-medium">{freeCount}</span>
          <span className="text-xs text-[var(--text-secondary)]">ตอนฟรี</span>
        </div>
        <div className="bg-[var(--bg-surface)] rounded-xl border border-[var(--border)] px-4 py-2.5 flex items-center gap-2">
          <Lock className="w-3.5 h-3.5 text-[var(--text-primary)]" />
          <span className="text-sm text-[var(--text-primary)] font-medium">{premiumCount}</span>
          <span className="text-xs text-[var(--text-secondary)]">ตอนล็อค</span>
        </div>
      </div>

      {/* Chapter list */}
      {chapters.length === 0 ? (
        <div className="text-center py-16 text-[var(--text-muted)] text-sm">
          ยังไม่มีตอน — {isNovel ? (
            <Link href={`/dashboard/manga/${mangaSlug}/write`} className="text-[var(--text-primary)] hover:underline">เขียนตอนแรก</Link>
          ) : (
            <Link href="/upload" className="text-[var(--text-primary)] hover:underline">อัปโหลดตอนแรก</Link>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {[...chapters].sort((a, b) => a.chapterNum - b.chapterNum).map((ch) => (
            <ChapterRow
              key={ch.id}
              chapter={ch}
              isNovel={isNovel}
              mangaSlug={mangaSlug}
              onUpdated={(updated) =>
                setChapters((prev) => prev.map((c) => (c.id === updated.id ? updated : c)))
              }
              onDeleted={(id) =>
                setChapters((prev) => prev.filter((c) => c.id !== id))
              }
            />
          ))}
        </div>
      )}

      <p className="text-xs text-[var(--text-muted)] text-center">
        คลิกเลขตอนเพื่อแก้หมายเลข · คลิก "ล็อค/ฟรี" เพื่อสลับสถานะ · คลิกราคาเพื่อแก้ไข · "หน้า" เพื่อจัดเรียงหน้า
      </p>
    </div>
  );
}
