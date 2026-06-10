"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Settings, Check, Loader2, Trash2, AlertTriangle, ChevronDown } from "lucide-react";
import clsx from "clsx";

interface MangaData {
  title: string;
  description: string;
  status: string;
  type: string;
  contentRating: string;
}

const STATUS = [
  { v: "ONGOING", l: "กำลังดำเนินเรื่อง" },
  { v: "COMPLETED", l: "จบแล้ว" },
  { v: "HIATUS", l: "หยุดพัก" },
];
const TYPE = [
  { v: "MANGA", l: "Manga" },
  { v: "MANHWA", l: "Manhwa" },
  { v: "MANHUA", l: "Manhua" },
  { v: "NOVEL", l: "Novel" },
];
const RATING = [
  { v: "EVERYONE", l: "ทุกวัย" },
  { v: "TEEN", l: "13+" },
  { v: "ADULT", l: "18+" },
];

const sel = "w-full bg-[var(--bg-card)] border border-[var(--border)] rounded-xl px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--text-primary)]/50";

export default function MangaSettings({ slug, manga }: { slug: string; manga: MangaData }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(manga);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [deleting, setDeleting] = useState(false);

  const set = (k: keyof MangaData, v: string) => { setForm((f) => ({ ...f, [k]: v })); setSaved(false); };

  async function save() {
    setSaving(true); setError(""); setSaved(false);
    try {
      const res = await fetch(`/api/manga/${slug}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) { setError("บันทึกไม่สำเร็จ"); return; }
      setSaved(true);
      router.refresh();
    } catch { setError("เกิดข้อผิดพลาด"); }
    finally { setSaving(false); }
  }

  async function deleteManga() {
    if (!confirm(`ลบเรื่อง "${manga.title}" ทั้งหมด?\n\nตอน หน้า คอมเมนต์ และข้อมูลทั้งหมดจะถูกลบถาวร ย้อนกลับไม่ได้`)) return;
    if (!confirm("ยืนยันอีกครั้ง: ลบเรื่องนี้ถาวร?")) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/manga/${slug}`, { method: "DELETE" });
      if (res.ok) { router.push("/dashboard"); router.refresh(); }
      else { setError("ลบไม่สำเร็จ"); setDeleting(false); }
    } catch { setError("เกิดข้อผิดพลาด"); setDeleting(false); }
  }

  return (
    <div className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border)] overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <span className="flex items-center gap-2 text-sm font-semibold text-[var(--text-primary)]">
          <Settings className="w-4 h-4 text-[var(--text-primary)]" /> ตั้งค่าเรื่อง
        </span>
        <ChevronDown className={clsx("w-4 h-4 text-[var(--text-secondary)] transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3 border-t border-[var(--border)] pt-4">
          <div>
            <label className="block text-xs text-[var(--text-secondary)] mb-1">ชื่อเรื่อง</label>
            <input value={form.title} onChange={(e) => set("title", e.target.value)} className={sel} />
          </div>
          <div>
            <label className="block text-xs text-[var(--text-secondary)] mb-1">เรื่องย่อ</label>
            <textarea value={form.description} onChange={(e) => set("description", e.target.value)} rows={3} className={`${sel} resize-none`} />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="block text-xs text-[var(--text-secondary)] mb-1">สถานะ</label>
              <select value={form.status} onChange={(e) => set("status", e.target.value)} className={sel}>
                {STATUS.map((s) => <option key={s.v} value={s.v}>{s.l}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-[var(--text-secondary)] mb-1">ประเภท</label>
              <select value={form.type} onChange={(e) => set("type", e.target.value)} className={sel}>
                {TYPE.map((s) => <option key={s.v} value={s.v}>{s.l}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-[var(--text-secondary)] mb-1">เรตติ้ง</label>
              <select value={form.contentRating} onChange={(e) => set("contentRating", e.target.value)} className={sel}>
                {RATING.map((s) => <option key={s.v} value={s.v}>{s.l}</option>)}
              </select>
            </div>
          </div>

          {error && <p className="text-sm text-red-400">{error}</p>}

          <div className="flex items-center gap-3">
            <button
              onClick={save}
              disabled={saving}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[var(--text-primary)] text-[var(--bg-primary)] text-sm font-semibold hover:opacity-90 disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <Check className="w-4 h-4" /> : null}
              {saved ? "บันทึกแล้ว" : "บันทึก"}
            </button>
          </div>

          {/* Danger zone */}
          <div className="mt-2 rounded-xl border border-red-500/30 bg-red-500/5 p-3">
            <div className="flex items-center gap-2 text-sm text-red-400 font-medium mb-1">
              <AlertTriangle className="w-4 h-4" /> โซนอันตราย
            </div>
            <p className="text-xs text-[var(--text-secondary)] mb-2">ลบเรื่องนี้พร้อมทุกตอนและหน้าถาวร</p>
            <button
              onClick={deleteManga}
              disabled={deleting}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-500/40 text-red-400 text-xs font-medium hover:bg-red-500/15 disabled:opacity-50"
            >
              {deleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
              ลบเรื่องนี้
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
