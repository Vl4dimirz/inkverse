"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Settings, Check, Loader2, Trash2, AlertTriangle, ChevronDown, Upload, ImageIcon, EyeOff, Send } from "lucide-react";
import clsx from "clsx";
import TagInput from "@/components/ui/TagInput";
import Adult18ConfirmModal from "@/components/ui/Adult18ConfirmModal";

interface MangaData {
  title: string;
  description: string;
  status: string;
  type: string;
  contentRating: string;
  coverUrl: string | null;
  tags: string[];
  published?: boolean;
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

// Phone photos are often 3–10 MB, which overran the cover endpoint's serverless
// body limit and left the upload spinning forever. Shrink client-side first —
// the cover only renders at 300×400, so ~1600px is plenty. Falls back to the
// original file if the canvas path fails (e.g. an unsupported codec).
async function downscaleImage(file: File, maxDim = 1600, quality = 0.85): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
    const w = Math.round(bitmap.width * scale);
    const h = Math.round(bitmap.height * scale);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close?.();
    const blob: Blob | null = await new Promise((res) =>
      canvas.toBlob((b) => res(b), "image/jpeg", quality)
    );
    return blob && blob.size < file.size ? blob : file;
  } catch {
    return file;
  }
}

export default function MangaSettings({
  slug, manga, allGenres, initialGenreIds,
}: {
  slug: string;
  manga: MangaData;
  allGenres: { id: string; name: string }[];
  initialGenreIds: string[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(manga);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [cover, setCover] = useState(manga.coverUrl);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [genreIds, setGenreIds] = useState<string[]>(initialGenreIds);
  const [published, setPublished] = useState(manga.published ?? true);
  const [togglingPublish, setTogglingPublish] = useState(false);
  const [showAdultConfirm, setShowAdultConfirm] = useState(false);

  async function togglePublish() {
    const next = !published;
    if (!next && !confirm(
      `เลิกเผยแพร่ทั้งเรื่อง "${manga.title}"?\n\nเรื่องจะซ่อนจากหน้าแรก รายการ ค้นหา และหน้าอ่านทันที — เนื้อหาและตอนทั้งหมดไม่หาย คุณยังแก้ต่อในแดชบอร์ดได้ และเผยแพร่ใหม่ได้ทุกเมื่อ`
    )) return;
    setTogglingPublish(true);
    setError("");
    try {
      const res = await fetch(`/api/manga/${slug}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ published: next }),
      });
      if (!res.ok) { setError("เปลี่ยนสถานะไม่สำเร็จ"); return; }
      setPublished(next);
      router.refresh();
    } catch { setError("เกิดข้อผิดพลาด"); }
    finally { setTogglingPublish(false); }
  }

  const toggleGenre = (id: string) => {
    setGenreIds((g) => (g.includes(id) ? g.filter((x) => x !== id) : [...g, id]));
    setSaved(false);
  };

  const set = (k: keyof MangaData, v: string) => { setForm((f) => ({ ...f, [k]: v })); setSaved(false); };

  async function onCoverChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploadingCover(true); setError("");
    try {
      const blob = await downscaleImage(file);
      const fd = new FormData();
      fd.append("file", blob, "cover.jpg");
      fd.append("slug", slug);
      // Hard timeout so a stalled upload never spins forever.
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 30000);
      let up: Response;
      try {
        up = await fetch("/api/upload/cover", { method: "POST", body: fd, signal: ctrl.signal });
      } finally {
        clearTimeout(timer);
      }
      const d = await up.json().catch(() => ({}));
      if (!up.ok || !d.url) {
        setError(d.code ? `[${d.code}] ${d.error}` : d.error || "อัปโหลดปกไม่สำเร็จ");
        return;
      }
      // Cache-bust so the new cover shows everywhere immediately (same key overwrites).
      const url = `${d.url}?v=${Date.now()}`;
      const patch = await fetch(`/api/manga/${slug}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ coverUrl: url }),
      });
      if (!patch.ok) { setError("บันทึกปกไม่สำเร็จ"); return; }
      setCover(url);
      router.refresh();
    } catch (err) {
      setError(
        err instanceof DOMException && err.name === "AbortError"
          ? "อัปโหลดนานเกินไป (หมดเวลา) — ลองรูปที่เล็กลง หรือเช็คเน็ต"
          : "เกิดข้อผิดพลาด"
      );
    } finally { setUploadingCover(false); }
  }

  function save() {
    // Newly marking the work 18+ → confirm (where it shows / is hidden + why) first.
    if (form.contentRating === "ADULT" && manga.contentRating !== "ADULT") {
      setShowAdultConfirm(true);
      return;
    }
    void doSave();
  }

  async function doSave() {
    setSaving(true); setError(""); setSaved(false);
    try {
      const res = await fetch(`/api/manga/${slug}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, genreIds }),
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
      <Adult18ConfirmModal
        open={showAdultConfirm}
        loading={saving}
        onCancel={() => setShowAdultConfirm(false)}
        onConfirm={() => {
          setShowAdultConfirm(false);
          void doSave();
        }}
      />
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
          {/* Cover */}
          <div>
            <label className="block text-xs text-[var(--text-secondary)] mb-1">ปก</label>
            <div className="flex items-center gap-3">
              <div className="w-16 h-[5.5rem] shrink-0 overflow-hidden border border-[var(--border)] bg-[var(--bg-card)] flex items-center justify-center">
                {cover ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={cover} alt="ปก" className="w-full h-full object-cover" />
                ) : (
                  <ImageIcon className="w-6 h-6 text-[var(--text-muted)]" />
                )}
              </div>
              <label className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bal-btn text-sm font-semibold cursor-pointer hover:opacity-90">
                {uploadingCover ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                {cover ? "เปลี่ยนปก" : "อัปโหลดปก"}
                <input type="file" accept="image/*" className="hidden" onChange={onCoverChange} disabled={uploadingCover} />
              </label>
            </div>
          </div>

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

          {/* Genres / tags */}
          <div>
            <label className="block text-xs text-[var(--text-secondary)] mb-1.5">หมวดหมู่ / แท็ก</label>
            <div className="flex flex-wrap gap-1.5">
              {allGenres.map((g) => (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => toggleGenre(g.id)}
                  className={clsx(
                    "px-2.5 py-1 rounded-full text-xs border transition-colors",
                    genreIds.includes(g.id)
                      ? "bg-[var(--text-primary)] text-[var(--bg-primary)] border-[var(--text-primary)]"
                      : "border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                  )}
                >
                  {g.name}
                </button>
              ))}
            </div>
          </div>

          {/* Custom tags */}
          <div>
            <label className="block text-xs text-[var(--text-secondary)] mb-1.5">แท็ก (พิมพ์เองได้ — คนอ่านค้นตามแท็ก)</label>
            <TagInput value={form.tags} onChange={(t) => { setForm((f) => ({ ...f, tags: t })); setSaved(false); }} />
          </div>

          {error && <p className="text-sm text-[var(--text-primary)]">{error}</p>}

          <div className="flex items-center gap-3">
            <button
              onClick={save}
              disabled={saving}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bal-btn text-sm font-semibold hover:opacity-90 disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <Check className="w-4 h-4" /> : null}
              {saved ? "บันทึกแล้ว" : "บันทึก"}
            </button>
          </div>

          {/* Visibility — publish / unpublish whole story */}
          <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-3">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="min-w-0">
                <p className="text-xs font-medium text-[var(--text-primary)] mb-0.5">การมองเห็นเรื่อง</p>
                {published ? (
                  <p className="text-xs text-[var(--text-secondary)]">เผยแพร่แล้ว — ผู้อ่านเห็นเรื่องนี้</p>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[9px] px-2 py-0.5 border border-[var(--border)] text-[var(--text-secondary)] uppercase tracking-widest">
                    <EyeOff className="w-2.5 h-2.5" /> ซ่อนอยู่ / ไม่เผยแพร่
                  </span>
                )}
              </div>
              {published ? (
                <button
                  onClick={togglePublish}
                  disabled={togglingPublish}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--border)] text-[var(--text-primary)] text-xs font-medium hover:bg-[var(--bg-surface)] disabled:opacity-50 transition-colors shrink-0"
                >
                  {togglingPublish ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <EyeOff className="w-3.5 h-3.5" />}
                  เลิกเผยแพร่ทั้งเรื่อง
                </button>
              ) : (
                <button
                  onClick={togglePublish}
                  disabled={togglingPublish}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bal-btn text-xs font-semibold disabled:opacity-50 shrink-0"
                >
                  {togglingPublish ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                  เผยแพร่ทั้งเรื่อง
                </button>
              )}
            </div>
          </div>

          {/* Danger zone */}
          <div className="mt-2 rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-3">
            <div className="flex items-center gap-2 text-sm text-[var(--text-primary)] font-medium mb-1">
              <AlertTriangle className="w-4 h-4" /> โซนอันตราย
            </div>
            <p className="text-xs text-[var(--text-secondary)] mb-2">ลบเรื่องนี้พร้อมทุกตอนและหน้าถาวร</p>
            <button
              onClick={deleteManga}
              disabled={deleting}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--border)] text-[var(--text-primary)] text-xs font-medium hover:bg-[var(--bg-surface)] disabled:opacity-50"
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
