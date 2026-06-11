"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Lock, Unlock, Coins, ArrowUpDown, Check, X, Loader2,
  ChevronRight, GripVertical, Edit3, Trash2, Clock, ChevronDown, Layers,
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
  freeAt?: string | null;
}

function fmtFree(iso: string): string {
  return new Date(iso).toLocaleString("th-TH", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
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
  const [editingEarly, setEditingEarly] = useState(false);
  const [earlyInput, setEarlyInput] = useState("2");
  const [loading, setLoading] = useState(false);

  const earlyActive = !!chapter.freeAt && new Date(chapter.freeAt).getTime() > Date.now();

  // days = number → free in N days; null → permanent premium (clear freeAt).
  async function setEarly(days: number | null) {
    const freeAt = days === null ? null : new Date(Date.now() + days * 86400000).toISOString();
    await patchChapter({ isPremium: true, coinCost: parseInt(priceInput) || chapter.coinCost || 2, freeAt });
    setEditingEarly(false);
  }
  async function applyEarly() {
    const d = parseInt(earlyInput);
    if (!d || d < 1) return;
    await setEarly(d);
  }

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
      "flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3 rounded-xl border transition-all",
      chapter.isPremium
        ? "bg-[var(--bg-card)] border-[var(--border)] hover:border-[var(--text-primary)]"
        : "bg-[var(--bg-card)] border-[var(--border)] hover:border-[var(--border)]"
    )}>
      {/* num + title — full width on mobile so the action buttons wrap below instead of covering the title */}
      <div className="flex items-center gap-3 flex-1 min-w-0 basis-full sm:basis-0">
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
      </div>

      {/* Lock / Price control */}
      <div className="flex items-center gap-2 shrink-0 ml-auto">
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

        {/* Early access — auto-free date */}
        {chapter.isPremium && (
          editingEarly ? (
            <div className="flex items-center gap-1 flex-wrap">
              <input
                autoFocus
                type="number"
                min="1"
                value={earlyInput}
                onChange={(e) => setEarlyInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") applyEarly(); if (e.key === "Escape") setEditingEarly(false); }}
                placeholder="วัน"
                className="w-14 bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg px-2 py-1 text-xs text-[var(--text-primary)] text-center focus:outline-none"
              />
              <span className="text-xs text-[var(--text-secondary)]">วัน</span>
              <button onClick={applyEarly} disabled={loading} title="ตั้งอ่านล่วงหน้า" className="p-1 text-[var(--text-primary)]">
                {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
              </button>
              <button onClick={() => setEarly(null)} disabled={loading}
                title="ติดเหรียญถาวร (ไม่ปลดฟรี)"
                className="px-2 py-1 rounded-lg bg-[var(--bg-card)] border border-[var(--border)] text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors">
                ถาวร
              </button>
              <button onClick={() => setEditingEarly(false)} className="p-1 text-[var(--text-secondary)]"><X className="w-3.5 h-3.5" /></button>
            </div>
          ) : (
            <button onClick={() => setEditingEarly(true)} disabled={loading}
              title="ตั้งวันปลดเป็นฟรีอัตโนมัติ (อ่านล่วงหน้า)"
              className="flex items-center gap-1 px-2 py-1 rounded-lg bg-[var(--bg-card)] border border-[var(--border)] text-xs text-[var(--text-primary)] hover:border-[var(--text-primary)] transition-colors">
              <Clock className="w-3 h-3" />
              {earlyActive ? `ฟรี ${fmtFree(chapter.freeAt!)}` : "อ่านล่วงหน้า"}
            </button>
          )
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

  // ── Bulk apply (range) ──────────────────────────────────────────
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bFrom, setBFrom] = useState("");
  const [bTo, setBTo] = useState("");
  const [bCoins, setBCoins] = useState("2");
  const [bDays, setBDays] = useState("2"); // "" or "0" = ถาวร
  const [bMode, setBMode] = useState<"premium" | "free">("premium");
  const [bLoading, setBLoading] = useState(false);
  const [bMsg, setBMsg] = useState("");

  async function applyBulk() {
    const lo = Math.min(Number(bFrom), Number(bTo));
    const hi = Math.max(Number(bFrom), Number(bTo));
    if (!Number.isFinite(lo) || !Number.isFinite(hi)) { setBMsg("กรอกช่วงตอนให้ครบ"); return; }
    const days = bMode === "premium" && bDays && Number(bDays) > 0 ? Number(bDays) : null;
    setBLoading(true); setBMsg("");
    try {
      const res = await fetch(`/api/manga/${mangaSlug}/chapters/bulk`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          bMode === "free"
            ? { fromNum: lo, toNum: hi, mode: "free" }
            : { fromNum: lo, toNum: hi, mode: "premium", coinCost: Number(bCoins) || 2, freeInDays: days }
        ),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) { setBMsg(d.error || "ไม่สำเร็จ"); return; }
      const freeAtIso = days ? new Date(Date.now() + days * 86400000).toISOString() : null;
      setChapters((prev) => prev.map((c) => {
        if (c.chapterNum < lo || c.chapterNum > hi) return c;
        return bMode === "free"
          ? { ...c, isPremium: false, coinCost: 0, freeAt: null }
          : { ...c, isPremium: true, coinCost: Number(bCoins) || 2, freeAt: freeAtIso };
      }));
      setBMsg(`อัปเดต ${d.count} ตอนแล้ว`);
    } finally {
      setBLoading(false);
    }
  }

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

      {/* Bulk manage range */}
      {chapters.length > 0 && (
        <div className="bg-[var(--bg-surface)] rounded-xl border border-[var(--border)] overflow-hidden">
          <button onClick={() => setBulkOpen((o) => !o)} className="w-full flex items-center justify-between px-4 py-3 text-left">
            <span className="flex items-center gap-2 text-sm font-semibold text-[var(--text-primary)]">
              <Layers className="w-4 h-4" /> จัดการหลายตอนพร้อมกัน
            </span>
            <ChevronDown className={clsx("w-4 h-4 text-[var(--text-secondary)] transition-transform", bulkOpen && "rotate-180")} />
          </button>
          {bulkOpen && (
            <div className="px-4 pb-4 border-t border-[var(--border)] pt-4 space-y-3">
              <div className="flex items-center gap-2 text-sm text-[var(--text-secondary)] flex-wrap">
                <span>ตอนที่</span>
                <input type="number" value={bFrom} onChange={(e) => setBFrom(e.target.value)} placeholder="เริ่ม"
                  className="w-16 bg-[var(--bg-card)] border border-[var(--border)] rounded-lg px-2 py-1 text-[var(--text-primary)] text-center focus:outline-none" />
                <span>ถึง</span>
                <input type="number" value={bTo} onChange={(e) => setBTo(e.target.value)} placeholder="จบ"
                  className="w-16 bg-[var(--bg-card)] border border-[var(--border)] rounded-lg px-2 py-1 text-[var(--text-primary)] text-center focus:outline-none" />
              </div>
              <div className="flex gap-2">
                {([["premium", "ล็อคเหรียญ"], ["free", "เปิดฟรี"]] as const).map(([m, l]) => (
                  <button key={m} onClick={() => setBMode(m)}
                    className={clsx("px-3 py-1.5 rounded-lg text-xs border transition-colors",
                      bMode === m ? "bg-[var(--text-primary)] text-[var(--bg-primary)] border-[var(--text-primary)]" : "border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]")}>
                    {l}
                  </button>
                ))}
              </div>
              {bMode === "premium" && (
                <div className="flex items-center gap-2 text-sm text-[var(--text-secondary)] flex-wrap">
                  <span>ราคา</span>
                  <input type="number" value={bCoins} onChange={(e) => setBCoins(e.target.value)}
                    className="w-14 bg-[var(--bg-card)] border border-[var(--border)] rounded-lg px-2 py-1 text-[var(--text-primary)] text-center focus:outline-none" />
                  <span>เหรียญ</span>
                  <span className="ml-2">อ่านล่วงหน้า</span>
                  <input type="number" value={bDays} onChange={(e) => setBDays(e.target.value)}
                    className="w-14 bg-[var(--bg-card)] border border-[var(--border)] rounded-lg px-2 py-1 text-[var(--text-primary)] text-center focus:outline-none" />
                  <span>วัน</span>
                  <span className="text-[10px] text-[var(--text-muted)]">(0 = ถาวร)</span>
                </div>
              )}
              {bMsg && <p className="text-xs text-[var(--text-primary)]">{bMsg}</p>}
              <button onClick={applyBulk} disabled={bLoading}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bal-btn text-sm font-semibold disabled:opacity-50">
                {bLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : null} ใช้กับช่วงนี้
              </button>
            </div>
          )}
        </div>
      )}

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
