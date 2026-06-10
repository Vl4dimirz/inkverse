"use client";

import { useState, useRef } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  GripVertical, Save, Loader2, CheckCircle2, RotateCcw,
  ArrowLeft, AlertCircle,
} from "lucide-react";
import clsx from "clsx";

interface Page {
  id: string;
  pageNum: number;
  imageUrl: string;
  width: number | null;
  height: number | null;
}

export default function PageReorderClient({
  chapterId,
  chapterNum,
  mangaSlug,
  initialPages,
}: {
  chapterId: string;
  chapterNum: number;
  mangaSlug: string;
  initialPages: Page[];
}) {
  const router = useRouter();
  const [pages, setPages] = useState<Page[]>(
    [...initialPages].sort((a, b) => a.pageNum - b.pageNum)
  );
  const [original] = useState<Page[]>(initialPages);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const dragNode = useRef<HTMLDivElement | null>(null);

  const hasChanges = pages.some(
    (p, i) => p.id !== [...original].sort((a, b) => a.pageNum - b.pageNum)[i]?.id
  );

  // ── Drag handlers ──────────────────────────────────────────────
  function onDragStart(e: React.DragEvent, index: number) {
    setDragIndex(index);
    e.dataTransfer.effectAllowed = "move";
    // Transparent drag ghost (keep card visible via CSS)
    const ghost = document.createElement("div");
    ghost.style.cssText = "position:absolute;top:-9999px;width:80px;height:120px;background:var(--text-primary);border-radius:8px;";
    document.body.appendChild(ghost);
    e.dataTransfer.setDragImage(ghost, 40, 60);
    setTimeout(() => document.body.removeChild(ghost), 0);
  }

  function onDragOver(e: React.DragEvent, index: number) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (index !== overIndex) setOverIndex(index);
  }

  function onDrop(e: React.DragEvent, index: number) {
    e.preventDefault();
    if (dragIndex === null || dragIndex === index) {
      setDragIndex(null);
      setOverIndex(null);
      return;
    }
    const reordered = [...pages];
    const [moved] = reordered.splice(dragIndex, 1);
    reordered.splice(index, 0, moved);
    setPages(reordered);
    setDragIndex(null);
    setOverIndex(null);
    setSaved(false);
  }

  function onDragEnd() {
    setDragIndex(null);
    setOverIndex(null);
  }

  // ── Reset ──────────────────────────────────────────────────────
  function reset() {
    setPages([...original].sort((a, b) => a.pageNum - b.pageNum));
    setSaved(false);
    setError("");
  }

  // ── Save ───────────────────────────────────────────────────────
  async function save() {
    setSaving(true);
    setError("");
    try {
      const ordered = pages.map((p, i) => ({ id: p.id, pageNum: i + 1 }));
      const res = await fetch(`/api/chapters/${chapterId}/pages`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pages: ordered }),
      });
      if (!res.ok) {
        const d = await res.json() as { error?: string };
        setError(d.error ?? "เกิดข้อผิดพลาด");
        return;
      }
      // Update pageNum in local state to match saved order
      setPages((prev) => prev.map((p, i) => ({ ...p, pageNum: i + 1 })));
      setSaved(true);
      router.refresh();
    } catch {
      setError("เกิดข้อผิดพลาด กรุณาลองใหม่");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      {/* Sticky action bar */}
      <div className="sticky top-16 z-20 bg-[var(--bg-primary)]/90 backdrop-blur-md border-b border-[var(--border)] py-3 -mx-4 px-4 sm:-mx-6 sm:px-6 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm">
          {saved ? (
            <span className="flex items-center gap-1.5 text-green-400">
              <CheckCircle2 className="w-4 h-4" />
              บันทึกแล้ว
            </span>
          ) : hasChanges ? (
            <span className="flex items-center gap-1.5 text-yellow-400 text-xs">
              <AlertCircle className="w-3.5 h-3.5" />
              มีการเปลี่ยนแปลง — กด "บันทึก" เพื่อยืนยัน
            </span>
          ) : (
            <span className="text-[var(--text-muted)] text-xs">ลากเพื่อเปลี่ยนลำดับหน้า</span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {hasChanges && !saving && (
            <button
              onClick={reset}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/5 border border-[var(--border)] text-[var(--text-secondary)] text-xs hover:text-[var(--text-primary)] transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              รีเซ็ต
            </button>
          )}
          <button
            onClick={save}
            disabled={saving || !hasChanges}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[var(--text-primary)] text-[var(--bg-primary)] text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-40"
          >
            {saving
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : <Save className="w-4 h-4" />}
            บันทึกการจัดเรียง
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Page grid */}
      {pages.length === 0 ? (
        <div className="text-center py-20 text-[var(--text-muted)] text-sm">
          ตอนนี้ยังไม่มีหน้า
        </div>
      ) : (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
          {pages.map((page, index) => (
            <div
              key={page.id}
              draggable
              onDragStart={(e) => onDragStart(e, index)}
              onDragOver={(e) => onDragOver(e, index)}
              onDrop={(e) => onDrop(e, index)}
              onDragEnd={onDragEnd}
              className={clsx(
                "relative rounded-xl overflow-hidden border-2 cursor-grab active:cursor-grabbing select-none transition-all duration-150",
                dragIndex === index
                  ? "opacity-40 border-[var(--text-primary)]/60 scale-95"
                  : overIndex === index && dragIndex !== null
                  ? "border-[var(--text-primary)] shadow-lg shadow-[var(--text-primary)]/20 scale-[1.03]"
                  : "border-[var(--border)] hover:border-white/30"
              )}
              style={{ aspectRatio: "3/4" }}
            >
              {/* Page image */}
              <Image
                src={page.imageUrl}
                alt={`Page ${index + 1}`}
                fill
                className="object-cover pointer-events-none"
                sizes="(max-width: 640px) 33vw, 20vw"
                draggable={false}
              />

              {/* Drop indicator overlay */}
              {overIndex === index && dragIndex !== null && dragIndex !== index && (
                <div className="absolute inset-0 bg-[var(--text-primary)]/10 flex items-center justify-center">
                  <div className="w-8 h-1 bg-[var(--text-primary)] rounded-full" />
                </div>
              )}

              {/* Page number badge */}
              <div className="absolute top-1.5 left-1.5 w-6 h-6 rounded-full bg-black/80 backdrop-blur-sm flex items-center justify-center">
                <span className="text-[10px] font-bold text-[var(--text-primary)]">{index + 1}</span>
              </div>

              {/* Drag handle */}
              <div className="absolute top-1.5 right-1.5 p-0.5 rounded bg-black/60 opacity-60">
                <GripVertical className="w-3 h-3 text-[var(--text-primary)]" />
              </div>

              {/* Changed indicator */}
              {page.pageNum !== index + 1 && (
                <div className="absolute bottom-1.5 right-1.5 w-2 h-2 rounded-full bg-yellow-400" title="ลำดับเปลี่ยน" />
              )}
            </div>
          ))}
        </div>
      )}

      <p className="text-xs text-gray-700 text-center">
        {pages.length} หน้า · ลากแต่ละการ์ดเพื่อเปลี่ยนลำดับ · กด "บันทึก" เพื่อยืนยัน
      </p>
    </div>
  );
}
