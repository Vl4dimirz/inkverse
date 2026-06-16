"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Upload, Plus, X, ImageIcon, Loader2, CheckCircle2, Lock, Unlock } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { slugify } from "@/lib/slug";

const mangaSchema = z.object({
  title: z.string().min(1, "กรุณากรอกชื่อเรื่อง"),
  slug: z.string().min(1).regex(/^[a-z0-9฀-๿-]+$/, "ใช้ตัวอักษร a-z 0-9 ไทย และ - เท่านั้น"),
  description: z.string().min(10, "กรุณากรอกคำอธิบายอย่างน้อย 10 ตัวอักษร"),
  originCountry: z.enum(["JP", "KR", "CN", "TH"]),
  status: z.enum(["ONGOING", "COMPLETED", "HIATUS"]),
  type: z.enum(["MANGA", "MANHWA", "MANHUA", "NOVEL"]),
  contentRating: z.enum(["EVERYONE", "TEEN", "ADULT"]),
});

type MangaForm = z.infer<typeof mangaSchema>;

interface Genre { id: string; name: string; slug: string }
interface MangaOption { id: string; title: string; slug: string; latestChapter?: number | null }

// Compress a page image in the browser (downscale very wide images and
// re-encode as WebP) to cut upload size & R2 storage. Falls back to the
// original file if the canvas/WebP path is unavailable or not smaller.
async function compressImage(
  file: File
): Promise<{ blob: Blob; contentType: string; width: number; height: number }> {
  // High-fidelity: upload goes straight to R2 (presigned PUT, no serverless body
  // limit), so we keep pages crisp. Only cap extreme scans at 2560px wide
  // (retina/4K-ready); most pages keep their native resolution. WebP q0.92 is
  // visually near-lossless at a fraction of PNG/JPEG size.
  const MAX_WIDTH = 2560;
  const QUALITY = 0.92;
  const original = { blob: file, contentType: file.type || "image/jpeg", width: 0, height: 0 };
  try {
    const bitmap = await createImageBitmap(file);
    let width = bitmap.width;
    let height = bitmap.height;
    if (width > MAX_WIDTH) {
      height = Math.round(height * (MAX_WIDTH / width));
      width = MAX_WIDTH;
    }
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) { bitmap.close(); return { ...original, width: bitmap.width, height: bitmap.height }; }
    // Best-quality resampling when downscaling.
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/webp", QUALITY));
    // Prefer the re-encoded WebP whenever we produced one (normalises format);
    // only keep the original if encoding failed entirely.
    if (!blob) return { ...original, width, height };
    return { blob, contentType: "image/webp", width, height };
  } catch {
    return original;
  }
}

const IMG_RE = /\.(jpe?g|png|webp|gif|avif)$/i;

// Group a folder selection (webkitdirectory) into chapters by the sub-folder
// name that contains a number (e.g. "ตอนที่ 12" → 12). Pages sorted naturally.
function groupFilesByChapter(files: File[]): { num: number; files: File[] }[] {
  const groups = new Map<number, File[]>();
  for (const f of files) {
    if (!IMG_RE.test(f.name)) continue;
    const rel = (f as File & { webkitRelativePath?: string }).webkitRelativePath || f.name;
    const parts = rel.split("/");
    const folder = parts.length >= 2 ? parts[parts.length - 2] : "";
    const m = folder.match(/[\d.]+/);
    if (!m) continue;
    const num = parseFloat(m[0]);
    if (isNaN(num)) continue;
    if (!groups.has(num)) groups.set(num, []);
    groups.get(num)!.push(f);
  }
  const natSort = (a: File, b: File) => {
    const na = parseInt(a.name), nb = parseInt(b.name);
    if (!isNaN(na) && !isNaN(nb) && na !== nb) return na - nb;
    return a.name.localeCompare(b.name, undefined, { numeric: true });
  };
  return [...groups.entries()]
    .map(([num, fs]) => ({ num, files: fs.sort(natSort) }))
    .sort((a, b) => a.num - b.num);
}

// Upload all page images for ONE chapter: direct-to-R2 (presigned PUT) with a
// through-server fallback. Same path as single-chapter upload.
async function uploadPagesToChapter(
  chapterId: string,
  files: File[],
  onProgress?: (msg: string) => void
): Promise<{ ok: boolean; error?: string }> {
  const prepared = [];
  for (let i = 0; i < files.length; i++) {
    onProgress?.(`บีบอัด ${i + 1}/${files.length}`);
    prepared.push(await compressImage(files[i]));
  }
  const presignRes = await fetch("/api/upload/presign", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chapterId, files: prepared.map((p, i) => ({ pageNum: i + 1, contentType: p.contentType })) }),
  });
  if (!presignRes.ok) return { ok: false, error: "เตรียมอัปโหลดไม่สำเร็จ" };
  const { uploads } = (await presignRes.json()) as {
    uploads: { pageNum: number; key: string; contentType: string; uploadUrl: string }[];
  };
  const registered: { pageNum: number; key: string; width: number; height: number }[] = [];
  for (let i = 0; i < uploads.length; i++) {
    const u = uploads[i], p = prepared[i];
    onProgress?.(`อัปหน้า ${i + 1}/${uploads.length}`);
    let directOk = false;
    try {
      const put = await fetch(u.uploadUrl, { method: "PUT", headers: { "Content-Type": u.contentType }, body: p.blob });
      directOk = put.ok;
    } catch { directOk = false; }
    if (directOk) {
      registered.push({ pageNum: u.pageNum, key: u.key, width: p.width, height: p.height });
    } else {
      const fd = new FormData();
      fd.append("chapterId", chapterId);
      fd.append("startPage", String(u.pageNum));
      fd.append("files", new File([p.blob], `${u.pageNum}.webp`, { type: p.contentType }));
      const fb = await fetch("/api/upload/pages", { method: "POST", body: fd });
      if (!fb.ok) {
        const d = await fb.json().catch(() => ({} as { error?: string }));
        return { ok: false, error: d?.error || `อัปหน้า ${i + 1} ล้มเหลว` };
      }
    }
  }
  if (registered.length > 0) {
    const reg = await fetch("/api/upload/pages", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chapterId, pages: registered }),
    });
    if (!reg.ok) return { ok: false, error: "บันทึกหน้าไม่สำเร็จ" };
  }
  return { ok: true };
}

export default function UploadForm({ genres }: { genres: Genre[] }) {
  const [tab, setTab] = useState<"manga" | "chapter">("manga");

  // --- Manga tab ---
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState("");
  const [selectedGenreIds, setSelectedGenreIds] = useState<string[]>([]);
  const [mangaLoading, setMangaLoading] = useState(false);
  const [mangaSuccess, setMangaSuccess] = useState<{ slug: string; title: string } | null>(null);
  const [mangaError, setMangaError] = useState("");

  // --- Chapter tab ---
  const [myMangas, setMyMangas] = useState<MangaOption[]>([]);
  const [mangasFetched, setMangasFetched] = useState(false);
  const [selectedSlug, setSelectedSlug] = useState("");
  const [chapterNum, setChapterNum] = useState("");
  const [chapterTitle, setChapterTitle] = useState("");
  const [isPremium, setIsPremium] = useState(false);
  const [coinCost, setCoinCost] = useState("5");
  const [pageFiles, setPageFiles] = useState<File[]>([]);
  const [pagePreviews, setPagePreviews] = useState<string[]>([]);
  const [chapterLoading, setChapterLoading] = useState(false);
  const [chapterError, setChapterError] = useState("");
  const [chapterSuccess, setChapterSuccess] = useState<{ mangaSlug: string; chapterNum: number } | null>(null);
  const [uploadProgress, setUploadProgress] = useState("");
  const [preselect, setPreselect] = useState<string | null>(null);

  // --- Bulk (multi-chapter by folder) ---
  const [chapterMode, setChapterMode] = useState<"single" | "bulk">("single");
  const [bulkChapters, setBulkChapters] = useState<{ num: number; files: File[] }[]>([]);
  const [bulkPremium, setBulkPremium] = useState(false);
  const [bulkCoinCost, setBulkCoinCost] = useState("5");
  const [bulkResult, setBulkResult] = useState<{ ok: number; skipped: number; failed: number; errors: string[] } | null>(null);

  const { register, handleSubmit, formState: { errors }, setValue, reset } = useForm<MangaForm>({
    resolver: zodResolver(mangaSchema),
    defaultValues: { originCountry: "JP", status: "ONGOING", type: "MANGA", contentRating: "EVERYONE" },
  });

  useEffect(() => {
    if (tab === "chapter" && !mangasFetched) {
      fetch("/api/manga?mine=1", { cache: "no-store" })
        .then(r => r.json())
        .then(data => { setMyMangas(data.data || []); setMangasFetched(true); })
        .catch(() => setMangasFetched(true));
    }
  }, [tab, mangasFetched]);

  // Arriving from "อัปโหลดตอนเพิ่ม" (?manga=slug): open the chapter tab and
  // preselect that manga once the list has loaded.
  useEffect(() => {
    const slug = new URLSearchParams(window.location.search).get("manga");
    if (slug) { setPreselect(slug); setTab("chapter"); }
  }, []);

  useEffect(() => {
    if (!preselect || myMangas.length === 0) return;
    const m = myMangas.find((x) => x.slug === preselect);
    if (m) {
      setSelectedSlug(m.slug);
      setChapterNum(String((m.latestChapter ?? 0) + 1));
    }
    setPreselect(null);
  }, [preselect, myMangas]);

  const toggleGenre = (id: string) =>
    setSelectedGenreIds(prev => prev.includes(id) ? prev.filter(g => g !== id) : [...prev, id]);

  const handleCoverChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) { setCoverFile(file); setCoverPreview(URL.createObjectURL(file)); }
  };

  const handlePageFilesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newFiles = Array.from(e.target.files || []);
    if (newFiles.length > 0) {
      setPageFiles(prev => [...prev, ...newFiles]);
      setPagePreviews(prev => [...prev, ...newFiles.map(f => URL.createObjectURL(f))]);
      e.target.value = "";
    }
  };

  const removePageFile = (index: number) => {
    URL.revokeObjectURL(pagePreviews[index]);
    setPageFiles(prev => prev.filter((_, i) => i !== index));
    setPagePreviews(prev => prev.filter((_, i) => i !== index));
  };

  const handleBulkFolderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setBulkChapters(groupFilesByChapter(files));
    setBulkResult(null);
    e.target.value = "";
  };

  const onSubmitBulk = async () => {
    setChapterError("");
    if (!selectedSlug) { setChapterError("กรุณาเลือกมังงะ"); return; }
    if (bulkChapters.length === 0) { setChapterError("กรุณาเลือกโฟลเดอร์ที่มีตอน (เช่น 'ตอนที่ 1')"); return; }
    setChapterLoading(true);
    setChapterSuccess(null);
    setBulkResult(null);
    let ok = 0, skipped = 0, failed = 0;
    const errors: string[] = [];
    for (let i = 0; i < bulkChapters.length; i++) {
      const { num, files } = bulkChapters[i];
      setUploadProgress(`ตอน ${num} (${i + 1}/${bulkChapters.length}) — กำลังสร้าง`);
      const createRes = await fetch(`/api/manga/${selectedSlug}/chapters`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chapterNum: num, isPremium: bulkPremium, coinCost: bulkPremium ? (parseInt(bulkCoinCost) || 0) : 0 }),
      });
      if (createRes.status === 409) { skipped++; continue; } // already exists → skip
      if (!createRes.ok) { failed++; errors.push(`ตอน ${num}: สร้างไม่สำเร็จ`); continue; }
      const chapter = await createRes.json();
      const res = await uploadPagesToChapter(chapter.id, files, (m) =>
        setUploadProgress(`ตอน ${num} (${i + 1}/${bulkChapters.length}) — ${m}`));
      if (res.ok) ok++;
      else { failed++; errors.push(`ตอน ${num}: ${res.error}`); }
    }
    setUploadProgress("");
    setBulkResult({ ok, skipped, failed, errors });
    setBulkChapters([]);
    setMangasFetched(false); // refresh latest-chapter hints
    setChapterLoading(false);
  };

  const onSubmitManga = async (data: MangaForm) => {
    setMangaLoading(true);
    setMangaError("");
    setMangaSuccess(null);
    try {
      let coverUrl: string | undefined;
      if (coverFile) {
        const fd = new FormData();
        fd.append("file", coverFile);
        fd.append("slug", data.slug);
        const r = await fetch("/api/upload/cover", { method: "POST", body: fd });
        if (r.ok) { const j = await r.json(); if (j.url) coverUrl = j.url; }
      }
      const res = await fetch("/api/manga", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, coverUrl, genreIds: selectedGenreIds }),
      });
      if (res.ok) {
        const manga = await res.json();
        setMangaSuccess({ slug: manga.slug, title: manga.title });
        reset();
        setCoverFile(null);
        setCoverPreview("");
        setSelectedGenreIds([]);
        // New manga won't be in the cached dropdown list — force a refetch
        // so it appears when the translator switches to the "chapter" tab.
        setMangasFetched(false);
      } else {
        const j = await res.json();
        setMangaError(j.error || "เกิดข้อผิดพลาด");
      }
    } finally {
      setMangaLoading(false);
    }
  };

  const onSubmitChapter = async () => {
    setChapterError("");
    if (!selectedSlug) { setChapterError("กรุณาเลือกมังงะ"); return; }
    if (!chapterNum || isNaN(parseFloat(chapterNum))) { setChapterError("กรุณากรอกหมายเลขตอน"); return; }
    if (pageFiles.length === 0) { setChapterError("กรุณาเพิ่มหน้าอย่างน้อย 1 หน้า"); return; }

    setChapterLoading(true);
    setChapterSuccess(null);
    try {
      setUploadProgress("กำลังสร้างตอน...");
      const createRes = await fetch(`/api/manga/${selectedSlug}/chapters`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chapterNum: parseFloat(chapterNum),
          title: chapterTitle || undefined,
          isPremium,
          coinCost: isPremium ? parseInt(coinCost) || 5 : 0,
        }),
      });
      if (!createRes.ok) {
        const j = await createRes.json();
        setChapterError(j.error || "ไม่สามารถสร้างตอนได้");
        return;
      }
      const chapter = await createRes.json();

      // Compress each page in the browser (→ WebP), then upload straight to R2
      // via presigned URLs — bytes never pass through the server (no size limit).
      const prepared: { blob: Blob; contentType: string; width: number; height: number }[] = [];
      for (let i = 0; i < pageFiles.length; i++) {
        setUploadProgress(`กำลังบีบอัดรูป ${i + 1}/${pageFiles.length}...`);
        prepared.push(await compressImage(pageFiles[i]));
      }

      const presignRes = await fetch("/api/upload/presign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chapterId: chapter.id,
          files: prepared.map((p, i) => ({ pageNum: i + 1, contentType: p.contentType })),
        }),
      });
      if (!presignRes.ok) {
        setChapterError("สร้างตอนแล้ว แต่เตรียมอัปโหลดไม่สำเร็จ");
        return;
      }
      const { uploads } = (await presignRes.json()) as {
        uploads: { pageNum: number; key: string; contentType: string; uploadUrl: string }[];
      };

      const registered: { pageNum: number; key: string; width: number; height: number }[] = [];
      for (let i = 0; i < uploads.length; i++) {
        const u = uploads[i];
        const p = prepared[i];
        setUploadProgress(`กำลังอัปโหลดหน้า ${i + 1}/${uploads.length}...`);

        // Try direct-to-R2 first; if the browser can't reach R2 (CORS/network),
        // fall back to uploading through our own API (same-origin, no CORS).
        let directOk = false;
        try {
          const putRes = await fetch(u.uploadUrl, {
            method: "PUT",
            headers: { "Content-Type": u.contentType },
            body: p.blob,
          });
          directOk = putRes.ok;
        } catch {
          directOk = false;
        }

        if (directOk) {
          registered.push({ pageNum: u.pageNum, key: u.key, width: p.width, height: p.height });
        } else {
          const fd = new FormData();
          fd.append("chapterId", chapter.id);
          fd.append("startPage", String(u.pageNum));
          fd.append("files", new File([p.blob], `${u.pageNum}.webp`, { type: p.contentType }));
          const fb = await fetch("/api/upload/pages", { method: "POST", body: fd });
          if (!fb.ok) {
            const data = await fb.json().catch(() => ({} as { error?: string }));
            const msg =
              fb.status === 413
                ? `หน้า ${i + 1} ไฟล์ใหญ่เกินไป`
                : data?.error || `อัปโหลดหน้า ${i + 1} ล้มเหลว (${fb.status})`;
            setChapterError(`สร้างตอนแล้ว แต่${msg} (สำเร็จ ${i} หน้า — เพิ่มที่เหลือได้ที่จัดการตอน)`);
            return;
          }
          // The server path already created the Page record.
        }
      }

      // Register the pages that uploaded directly to R2.
      if (registered.length > 0) {
        setUploadProgress("กำลังบันทึก...");
        const regRes = await fetch("/api/upload/pages", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chapterId: chapter.id, pages: registered }),
        });
        if (!regRes.ok) {
          setChapterError("อัปโหลดรูปสำเร็จ แต่บันทึกหน้าไม่สำเร็จ");
          return;
        }
      }

      setChapterSuccess({ mangaSlug: selectedSlug, chapterNum: parseFloat(chapterNum) });
      setSelectedSlug("");
      setChapterNum("");
      setChapterTitle("");
      setIsPremium(false);
      setCoinCost("5");
      pagePreviews.forEach(url => URL.revokeObjectURL(url));
      setPageFiles([]);
      setPagePreviews([]);
      setMangasFetched(false);
    } catch (err) {
      // Network/CORS errors on the direct-to-R2 PUT reject (throw) rather than
      // returning !ok — surface them instead of failing silently.
      setChapterError(
        `อัปโหลดล้มเหลว: ${err instanceof Error ? err.message : "เกิดข้อผิดพลาด"} — ` +
        "ตอนถูกสร้างแล้วแต่หน้ายังไม่ครบ ลองอัปใหม่ที่หน้า 'จัดการตอน'"
      );
    } finally {
      setChapterLoading(false);
      setUploadProgress("");
    }
  };

  const inputCls =
    "w-full bg-[var(--bg-card)] border border-[var(--border)] rounded-xl px-4 py-2.5 text-sm text-[var(--text-primary)] placeholder-gray-500 focus:outline-none focus:border-[var(--text-primary)]/50 transition-colors";

  return (
    <div>
      {/* Tab switcher */}
      <div className="flex gap-2 mb-6">
        {(["manga", "chapter"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-5 py-2 rounded-xl text-sm font-medium transition-all ${
              tab === t
                ? "bal-btn"
                : "bg-[var(--bg-surface)] text-[var(--text-secondary)] border border-[var(--border)] hover:text-[var(--text-primary)]"
            }`}
          >
            {t === "manga" ? "สร้างมังงะใหม่" : "อัปโหลดตอนใหม่"}
          </button>
        ))}
      </div>

      {/* ── Manga Tab ── */}
      {tab === "manga" && (
        mangaSuccess ? (
          <div className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border)] p-10 text-center space-y-5">
            <div className="w-16 h-16 rounded-full bg-[var(--bg-card)] border border-[var(--border)] flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-8 h-8 text-[var(--text-primary)]" />
            </div>
            <div>
              <h2 className="font-bebas text-2xl text-[var(--text-primary)] tracking-wider mb-1">สร้างมังงะสำเร็จ!</h2>
              <p className="text-[var(--text-secondary)] text-sm">{mangaSuccess.title}</p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link
                href={`/content/${mangaSuccess.slug}`}
                className="px-5 py-2.5 rounded-xl bg-[var(--bg-card)] border border-[var(--border)] text-[var(--text-primary)] text-sm font-medium hover:border-white/30 transition-all"
              >
                ดูมังงะ
              </Link>
              <button
                onClick={() => {
                  setSelectedSlug(mangaSuccess.slug);
                  setMangasFetched(false);
                  setMangaSuccess(null);
                  setTab("chapter");
                }}
                className="px-5 py-2.5 rounded-xl bal-btn text-sm font-medium hover:opacity-90 transition-colors"
              >
                อัปโหลดตอนแรก →
              </button>
            </div>
            <button
              onClick={() => setMangaSuccess(null)}
              className="text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
            >
              + สร้างมังงะใหม่
            </button>
          </div>
        ) : (
          <form
            onSubmit={handleSubmit(onSubmitManga)}
            className="space-y-5 bg-[var(--bg-surface)] rounded-2xl border border-[var(--border)] p-6"
          >
            {/* Cover */}
            <div>
              <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">ภาพปก</label>
              <div className="flex items-start gap-4">
                {coverPreview ? (
                  <div className="relative w-24 h-32 rounded-xl overflow-hidden flex-shrink-0">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={coverPreview} alt="preview" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => { setCoverFile(null); setCoverPreview(""); }}
                      className="absolute top-1 right-1 p-0.5 rounded-full bg-black/60 text-[var(--text-primary)] hover:bg-[var(--bg-surface)] transition-colors"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ) : (
                  <label className="w-24 h-32 flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-white/20 hover:border-[var(--text-primary)]/50 cursor-pointer transition-colors bg-[var(--bg-card)]">
                    <Upload className="w-6 h-6 text-[var(--text-secondary)] mb-1" />
                    <span className="text-[10px] text-[var(--text-secondary)]">คลิกเพื่ออัปโหลด</span>
                    <input type="file" accept="image/*" className="hidden" onChange={handleCoverChange} />
                  </label>
                )}
                <p className="text-xs text-[var(--text-secondary)] mt-2">รองรับ JPG, PNG, WebP ขนาดที่แนะนำ 300×400px</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-[var(--text-primary)] mb-1.5">ชื่อเรื่อง *</label>
                <input
                  {...register("title", {
                    onChange: (e) => {
                      // Keep Thai so a Thai title gets a Thai slug (still editable below).
                      setValue("slug", slugify(e.target.value));
                    },
                  })}
                  placeholder="ชื่อเรื่อง..."
                  className={inputCls}
                />
                {errors.title && <p className="text-xs text-[var(--text-primary)] mt-1">{errors.title.message}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--text-primary)] mb-1.5">Slug (URL) *</label>
                <input {...register("slug")} placeholder="manga-slug-here" className={inputCls} />
                {errors.slug && <p className="text-xs text-[var(--text-primary)] mt-1">{errors.slug.message}</p>}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-[var(--text-primary)] mb-1.5">คำอธิบาย *</label>
              <textarea {...register("description")} rows={4} placeholder="เรื่องย่อ..." className={`${inputCls} resize-none`} />
              {errors.description && <p className="text-xs text-[var(--text-primary)] mt-1">{errors.description.message}</p>}
            </div>

            {/* Genre selector */}
            {genres.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
                  หมวดหมู่{" "}
                  {selectedGenreIds.length > 0 && (
                    <span className="text-[var(--text-primary)] text-xs">({selectedGenreIds.length} เลือก)</span>
                  )}
                </label>
                <div className="flex flex-wrap gap-2">
                  {genres.map((g) => (
                    <button
                      key={g.id}
                      type="button"
                      onClick={() => toggleGenre(g.id)}
                      className={`px-3 py-1 rounded-lg text-xs font-medium transition-all border ${
                        selectedGenreIds.includes(g.id)
                          ? "bg-[var(--text-primary)]/20 border-[var(--text-primary)]/50 text-[var(--text-primary)]"
                          : "bg-[var(--bg-card)] border-[var(--border)] text-[var(--text-secondary)] hover:border-white/30 hover:text-[var(--text-primary)]"
                      }`}
                    >
                      {g.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-[var(--text-primary)] mb-1.5">ประเทศต้นกำเนิด</label>
                <select {...register("originCountry")} className={inputCls}>
                  <option value="JP">🇯🇵 ญี่ปุ่น</option>
                  <option value="KR">🇰🇷 เกาหลี</option>
                  <option value="CN">🇨🇳 จีน</option>
                  <option value="TH">🇹🇭 ไทย</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--text-primary)] mb-1.5">สถานะ</label>
                <select {...register("status")} className={inputCls}>
                  <option value="ONGOING">กำลังดำเนินเรื่อง</option>
                  <option value="COMPLETED">จบแล้ว</option>
                  <option value="HIATUS">หยุดพัก</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--text-primary)] mb-1.5">ประเภท</label>
                <select {...register("type")} className={inputCls}>
                  <option value="MANGA">Manga</option>
                  <option value="MANHWA">Manhwa</option>
                  <option value="MANHUA">Manhua</option>
                  <option value="NOVEL">Novel</option>
                </select>
              </div>
            </div>

            {/* Content rating */}
            <div>
              <label className="block text-sm font-medium text-[var(--text-primary)] mb-1.5">
                เรตติ้งเนื้อหา
              </label>
              <select {...register("contentRating")} className={inputCls}>
                <option value="EVERYONE">ทุกวัย (Everyone)</option>
                <option value="TEEN">วัยรุ่น 13+ (Teen)</option>
                <option value="ADULT">ผู้ใหญ่ 18+ (Adult)</option>
              </select>
              <p className="text-xs text-[var(--text-muted)] mt-1">
                เนื้อหา 18+ จะต้องผ่านการยืนยันอายุก่อนเข้าชม
              </p>
            </div>

            {mangaError && (
              <div className="p-3 rounded-xl bg-[var(--bg-card)] border border-[var(--border)] text-sm text-[var(--text-primary)]">
                {mangaError}
              </div>
            )}

            <button
              type="submit"
              disabled={mangaLoading}
              className="w-full py-3 rounded-xl bal-btn font-semibold text-sm hover:opacity-90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <Plus className="w-4 h-4" />
              {mangaLoading ? "กำลังสร้าง..." : "สร้างมังงะ"}
            </button>
          </form>
        )
      )}

      {/* ── Chapter Tab ── */}
      {tab === "chapter" && (
        chapterSuccess ? (
          <div className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border)] p-10 text-center space-y-5">
            <div className="w-16 h-16 rounded-full bg-[var(--bg-card)] border border-[var(--border)] flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-8 h-8 text-[var(--text-primary)]" />
            </div>
            <div>
              <h2 className="font-bebas text-2xl text-[var(--text-primary)] tracking-wider mb-1">อัปโหลดสำเร็จ!</h2>
              <p className="text-[var(--text-secondary)] text-sm">ตอนที่ {chapterSuccess.chapterNum} ถูกเพิ่มแล้ว</p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link
                href={`/content/${chapterSuccess.mangaSlug}`}
                className="px-5 py-2.5 rounded-xl bg-[var(--bg-card)] border border-[var(--border)] text-[var(--text-primary)] text-sm font-medium hover:border-white/30 transition-all"
              >
                ดูมังงะ
              </Link>
              <Link
                href={`/content/${chapterSuccess.mangaSlug}/${chapterSuccess.chapterNum}`}
                className="px-5 py-2.5 rounded-xl bal-btn text-sm font-medium hover:opacity-90 transition-colors"
              >
                อ่านตอนนี้
              </Link>
            </div>
            <button
              onClick={() => setChapterSuccess(null)}
              className="text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
            >
              + อัปโหลดตอนต่อไป
            </button>
          </div>
        ) : (
          <div className="space-y-5 bg-[var(--bg-surface)] rounded-2xl border border-[var(--border)] p-6">
            {/* Manga selector */}
            <div>
              <label className="block text-sm font-medium text-[var(--text-primary)] mb-1.5">เลือกมังงะ *</label>
              <select
                value={selectedSlug}
                onChange={e => {
                  const slug = e.target.value;
                  setSelectedSlug(slug);
                  // Auto-suggest the next chapter number to avoid "already exists".
                  const m = myMangas.find(x => x.slug === slug);
                  if (m) setChapterNum(String((m.latestChapter ?? 0) + 1));
                }}
                className={inputCls}
              >
                <option value="">-- เลือกมังงะ --</option>
                {myMangas.map(m => (
                  <option key={m.id} value={m.slug}>{m.title}</option>
                ))}
              </select>
              {mangasFetched && myMangas.length === 0 && (
                <p className="text-xs text-[var(--text-secondary)] mt-1">
                  ยังไม่มีมังงะ{" "}
                  <button type="button" onClick={() => setTab("manga")} className="text-[var(--text-primary)] hover:underline">
                    สร้างมังงะก่อน
                  </button>
                </p>
              )}
            </div>

            {/* Mode toggle: single chapter vs bulk-by-folder */}
            <div className="flex gap-2">
              {([["single", "ตอนเดียว"], ["bulk", "หลายตอน (เลือกโฟลเดอร์)"]] as const).map(([m, label]) => (
                <button key={m} type="button" onClick={() => { setChapterMode(m); setChapterError(""); }}
                  className={`px-4 py-2 rounded-lg text-sm border transition-colors ${chapterMode === m ? "bal-btn" : "bg-[var(--bg-card)] border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--text-primary)]/40"}`}>
                  {label}
                </button>
              ))}
            </div>

            {chapterMode === "bulk" && (
              <div className="space-y-4">
                <p className="text-xs text-[var(--text-secondary)] bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-3 leading-relaxed">
                  เลือกโฟลเดอร์ที่ข้างในมีโฟลเดอร์ย่อยแต่ละตอน เช่น <span className="text-[var(--text-primary)]">ตอนที่ 1/</span> · <span className="text-[var(--text-primary)]">ตอนที่ 2/</span> … ระบบจะสร้างและอัปทุกตอนให้อัตโนมัติ (ตอนที่มีอยู่แล้วจะข้าม)
                </p>
                <label className="flex flex-col items-center justify-center h-32 rounded-xl border-2 border-dashed border-white/20 hover:border-[var(--text-primary)]/50 cursor-pointer transition-colors bg-[var(--bg-card)]">
                  <Upload className="w-8 h-8 text-[var(--text-secondary)] mb-2" />
                  <span className="text-sm text-[var(--text-secondary)]">
                    {bulkChapters.length > 0
                      ? `เลือกแล้ว ${bulkChapters.length} ตอน · ${bulkChapters.reduce((s, c) => s + c.files.length, 0)} รูป`
                      : "คลิกเพื่อเลือกโฟลเดอร์มังงะ"}
                  </span>
                  {/* @ts-expect-error non-standard directory attributes */}
                  <input type="file" className="hidden" webkitdirectory="" directory="" multiple onChange={handleBulkFolderChange} />
                </label>

                <div className="flex items-center gap-4 flex-wrap">
                  <button type="button" onClick={() => setBulkPremium(p => !p)} className="flex items-center gap-3">
                    <div className={`w-11 h-6 rounded-full transition-colors relative ${bulkPremium ? "bg-[var(--text-primary)]" : "bg-white/10"}`}>
                      <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${bulkPremium ? "translate-x-6" : "translate-x-1"}`} />
                    </div>
                    <span className="text-sm text-[var(--text-primary)]">{bulkPremium ? "ทุกตอนพรีเมียม" : "ทุกตอนฟรี"}</span>
                  </button>
                  {bulkPremium && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-[var(--text-secondary)]">ราคา/ตอน</span>
                      <input type="number" min="1" value={bulkCoinCost} onChange={e => setBulkCoinCost(e.target.value)}
                        className="w-20 bg-[var(--bg-card)] border border-[var(--border)] rounded-lg px-3 py-1.5 text-sm text-[var(--text-primary)] text-center focus:outline-none focus:border-[var(--text-primary)]/50" />
                      <span className="text-xs text-[var(--text-primary)]">เหรียญ</span>
                    </div>
                  )}
                </div>

                {bulkResult && (
                  <div className="p-3 rounded-xl bg-[var(--bg-card)] border border-[var(--border)] text-sm text-[var(--text-primary)]">
                    เสร็จ · สำเร็จ {bulkResult.ok} ตอน · ข้าม {bulkResult.skipped} · ล้มเหลว {bulkResult.failed}
                    {bulkResult.errors.length > 0 && (
                      <div className="text-xs text-[var(--text-secondary)] mt-1">{bulkResult.errors.slice(0, 4).join(" · ")}</div>
                    )}
                  </div>
                )}

                <button type="button" onClick={onSubmitBulk} disabled={chapterLoading || !selectedSlug || bulkChapters.length === 0}
                  className="w-full py-3 rounded-xl bal-btn font-semibold text-sm hover:opacity-90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                  <Upload className="w-4 h-4" />
                  {chapterLoading ? "กำลังอัปโหลด..." : `อัปโหลด${bulkChapters.length ? ` ${bulkChapters.length} ตอน` : "หลายตอน"}`}
                </button>
              </div>
            )}

            {chapterMode === "single" && (<>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-[var(--text-primary)] mb-1.5">หมายเลขตอน *</label>
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  value={chapterNum}
                  onChange={e => setChapterNum(e.target.value)}
                  placeholder="1"
                  className={inputCls}
                />
                {(() => {
                  const m = myMangas.find(x => x.slug === selectedSlug);
                  return m && m.latestChapter != null ? (
                    <p className="text-xs text-[var(--text-secondary)] mt-1">ตอนล่าสุดที่มี: {m.latestChapter} — เลขถัดไปถูกกรอกให้แล้ว</p>
                  ) : null;
                })()}
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--text-primary)] mb-1.5">ชื่อตอน (ไม่บังคับ)</label>
                <input
                  type="text"
                  value={chapterTitle}
                  onChange={e => setChapterTitle(e.target.value)}
                  placeholder="ชื่อตอน..."
                  className={inputCls}
                />
              </div>
            </div>

            {/* Premium toggle */}
            <div className="flex items-center gap-4 flex-wrap">
              <button
                type="button"
                onClick={() => setIsPremium(p => !p)}
                className="flex items-center gap-3"
              >
                <div className={`w-11 h-6 rounded-full transition-colors relative ${isPremium ? "bg-[var(--text-primary)]" : "bg-white/10"}`}>
                  <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${isPremium ? "translate-x-6" : "translate-x-1"}`} />
                </div>
                <div className="flex items-center gap-1.5">
                  {isPremium
                    ? <Lock className="w-4 h-4 text-[var(--text-primary)]" />
                    : <Unlock className="w-4 h-4 text-[var(--text-secondary)]" />
                  }
                  <span className="text-sm text-[var(--text-primary)]">{isPremium ? "ตอนพรีเมียม" : "ตอนฟรี"}</span>
                </div>
              </button>
              {isPremium && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-[var(--text-secondary)]">ราคา</span>
                  <input
                    type="number"
                    min="1"
                    value={coinCost}
                    onChange={e => setCoinCost(e.target.value)}
                    className="w-20 bg-[var(--bg-card)] border border-[var(--border)] rounded-lg px-3 py-1.5 text-sm text-[var(--text-primary)] text-center focus:outline-none focus:border-[var(--text-primary)]/50"
                  />
                  <span className="text-xs text-[var(--text-primary)]">เหรียญ</span>
                </div>
              )}
            </div>

            {/* Pages upload */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-[var(--text-primary)]">
                  หน้ามังงะ *{" "}
                  {pageFiles.length > 0 && <span className="text-[var(--text-primary)]">({pageFiles.length} หน้า)</span>}
                </label>
                {pageFiles.length > 0 && (
                  <button
                    type="button"
                    onClick={() => { pagePreviews.forEach(u => URL.revokeObjectURL(u)); setPageFiles([]); setPagePreviews([]); }}
                    className="text-xs text-[var(--text-primary)] hover:text-[var(--text-primary)] transition-colors"
                  >
                    ล้างทั้งหมด
                  </button>
                )}
              </div>

              {pageFiles.length === 0 ? (
                <label className="flex flex-col items-center justify-center h-36 rounded-xl border-2 border-dashed border-white/20 hover:border-[var(--text-primary)]/50 cursor-pointer transition-colors bg-[var(--bg-card)]">
                  <ImageIcon className="w-10 h-10 text-[var(--text-secondary)] mb-2" />
                  <span className="text-sm text-[var(--text-secondary)]">คลิกเพื่อเลือกรูปหน้ามังงะ</span>
                  <span className="text-xs text-[var(--text-muted)] mt-1">JPG, PNG, WebP — รองรับหลายไฟล์</span>
                  <input type="file" accept="image/*" multiple className="hidden" onChange={handlePageFilesChange} />
                </label>
              ) : (
                <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2 max-h-72 overflow-y-auto p-1 bg-[var(--bg-card)] rounded-xl border border-[var(--border)]">
                  {pagePreviews.map((preview, i) => (
                    <div key={i} className="relative aspect-[2/3] rounded-lg overflow-hidden bg-black">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={preview} alt={`หน้า ${i + 1}`} className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => removePageFile(i)}
                        className="absolute top-0.5 right-0.5 p-0.5 rounded-full bg-black/70 text-[var(--text-primary)] hover:bg-[var(--bg-surface)] transition-colors"
                      >
                        <X className="w-2.5 h-2.5" />
                      </button>
                      <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-[10px] text-[var(--text-primary)] text-center py-0.5">
                        {i + 1}
                      </div>
                    </div>
                  ))}
                  <label className="relative aspect-[2/3] rounded-lg border-2 border-dashed border-white/20 hover:border-[var(--text-primary)]/50 cursor-pointer transition-colors flex items-center justify-center">
                    <Plus className="w-5 h-5 text-[var(--text-secondary)]" />
                    <input type="file" accept="image/*" multiple className="hidden" onChange={handlePageFilesChange} />
                  </label>
                </div>
              )}
            </div>
            </>)}

            {chapterError && (
              <div className="p-3 rounded-xl bg-[var(--bg-card)] border border-[var(--border)] text-sm text-[var(--text-primary)]">
                {chapterError}
              </div>
            )}

            {uploadProgress && (
              <div className="p-3 rounded-xl bg-[var(--bg-card)] border border-[var(--border)] text-sm text-[var(--text-secondary)] flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin flex-shrink-0" />
                {uploadProgress}
              </div>
            )}

            {chapterMode === "single" && (
              <button
                type="button"
                onClick={onSubmitChapter}
                disabled={chapterLoading}
                className="w-full py-3 rounded-xl bal-btn font-semibold text-sm hover:opacity-90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <Upload className="w-4 h-4" />
                {chapterLoading ? "กำลังอัปโหลด..." : "อัปโหลดตอน"}
              </button>
            )}
          </div>
        )
      )}
    </div>
  );
}
