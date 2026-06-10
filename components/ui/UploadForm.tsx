"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Upload, Plus, X, ImageIcon, Loader2, CheckCircle2, Lock, Unlock } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";

const mangaSchema = z.object({
  title: z.string().min(1, "กรุณากรอกชื่อเรื่อง"),
  slug: z.string().min(1).regex(/^[a-z0-9-]+$/, "ใช้ตัวอักษรพิมพ์เล็ก ตัวเลข และขีดกลางเท่านั้น"),
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
  const MAX_WIDTH = 2000;
  const QUALITY = 0.9;
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
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/webp", QUALITY));
    if (!blob || blob.size >= file.size) return { ...original, width, height };
    return { blob, contentType: "image/webp", width, height };
  } catch {
    return original;
  }
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
            const msg = fb.status === 413 ? `หน้า ${i + 1} ไฟล์ใหญ่เกินไป` : `อัปโหลดหน้า ${i + 1} ล้มเหลว`;
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
    "w-full bg-[var(--bg-card)] border border-[var(--border)] rounded-xl px-4 py-2.5 text-sm text-[var(--text-primary)] placeholder-gray-500 focus:outline-none focus:border-[#ff2d55]/50 transition-colors";

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
                ? "bg-gradient-to-r from-[#ff2d55] to-[#ff6b2b] text-[var(--text-primary)]"
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
          <div className="bg-[var(--bg-surface)] rounded-2xl border border-green-500/20 p-10 text-center space-y-5">
            <div className="w-16 h-16 rounded-full bg-green-500/10 border border-green-500/20 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-8 h-8 text-green-400" />
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
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#ff2d55] to-[#ff6b2b] text-[var(--text-primary)] text-sm font-medium hover:opacity-90 transition-opacity"
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
                      className="absolute top-1 right-1 p-0.5 rounded-full bg-black/60 text-[var(--text-primary)] hover:bg-red-500 transition-colors"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ) : (
                  <label className="w-24 h-32 flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-white/20 hover:border-[#ff2d55]/50 cursor-pointer transition-colors bg-[var(--bg-card)]">
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
                      setValue("slug", e.target.value.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, ""));
                    },
                  })}
                  placeholder="ชื่อเรื่อง..."
                  className={inputCls}
                />
                {errors.title && <p className="text-xs text-red-400 mt-1">{errors.title.message}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--text-primary)] mb-1.5">Slug (URL) *</label>
                <input {...register("slug")} placeholder="manga-slug-here" className={inputCls} />
                {errors.slug && <p className="text-xs text-red-400 mt-1">{errors.slug.message}</p>}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-[var(--text-primary)] mb-1.5">คำอธิบาย *</label>
              <textarea {...register("description")} rows={4} placeholder="เรื่องย่อ..." className={`${inputCls} resize-none`} />
              {errors.description && <p className="text-xs text-red-400 mt-1">{errors.description.message}</p>}
            </div>

            {/* Genre selector */}
            {genres.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
                  หมวดหมู่{" "}
                  {selectedGenreIds.length > 0 && (
                    <span className="text-[#ff6b2b] text-xs">({selectedGenreIds.length} เลือก)</span>
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
                          ? "bg-[#ff2d55]/20 border-[#ff2d55]/50 text-[#ff6b2b]"
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
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-sm text-red-400">
                {mangaError}
              </div>
            )}

            <button
              type="submit"
              disabled={mangaLoading}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-[#ff2d55] to-[#ff6b2b] text-[var(--text-primary)] font-semibold text-sm hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
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
          <div className="bg-[var(--bg-surface)] rounded-2xl border border-green-500/20 p-10 text-center space-y-5">
            <div className="w-16 h-16 rounded-full bg-green-500/10 border border-green-500/20 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-8 h-8 text-green-400" />
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
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#ff2d55] to-[#ff6b2b] text-[var(--text-primary)] text-sm font-medium hover:opacity-90 transition-opacity"
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
                  <button type="button" onClick={() => setTab("manga")} className="text-[#ff6b2b] hover:underline">
                    สร้างมังงะก่อน
                  </button>
                </p>
              )}
            </div>

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
                <div className={`w-11 h-6 rounded-full transition-colors relative ${isPremium ? "bg-[#ff2d55]" : "bg-white/10"}`}>
                  <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${isPremium ? "translate-x-6" : "translate-x-1"}`} />
                </div>
                <div className="flex items-center gap-1.5">
                  {isPremium
                    ? <Lock className="w-4 h-4 text-[#ff2d55]" />
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
                    className="w-20 bg-[var(--bg-card)] border border-[var(--border)] rounded-lg px-3 py-1.5 text-sm text-[var(--text-primary)] text-center focus:outline-none focus:border-[#ff2d55]/50"
                  />
                  <span className="text-xs text-yellow-400">เหรียญ</span>
                </div>
              )}
            </div>

            {/* Pages upload */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-[var(--text-primary)]">
                  หน้ามังงะ *{" "}
                  {pageFiles.length > 0 && <span className="text-[#ff6b2b]">({pageFiles.length} หน้า)</span>}
                </label>
                {pageFiles.length > 0 && (
                  <button
                    type="button"
                    onClick={() => { pagePreviews.forEach(u => URL.revokeObjectURL(u)); setPageFiles([]); setPagePreviews([]); }}
                    className="text-xs text-red-400 hover:text-red-300 transition-colors"
                  >
                    ล้างทั้งหมด
                  </button>
                )}
              </div>

              {pageFiles.length === 0 ? (
                <label className="flex flex-col items-center justify-center h-36 rounded-xl border-2 border-dashed border-white/20 hover:border-[#ff2d55]/50 cursor-pointer transition-colors bg-[var(--bg-card)]">
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
                        className="absolute top-0.5 right-0.5 p-0.5 rounded-full bg-black/70 text-[var(--text-primary)] hover:bg-red-500 transition-colors"
                      >
                        <X className="w-2.5 h-2.5" />
                      </button>
                      <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-[10px] text-[var(--text-primary)] text-center py-0.5">
                        {i + 1}
                      </div>
                    </div>
                  ))}
                  <label className="relative aspect-[2/3] rounded-lg border-2 border-dashed border-white/20 hover:border-[#ff2d55]/50 cursor-pointer transition-colors flex items-center justify-center">
                    <Plus className="w-5 h-5 text-[var(--text-secondary)]" />
                    <input type="file" accept="image/*" multiple className="hidden" onChange={handlePageFilesChange} />
                  </label>
                </div>
              )}
            </div>

            {chapterError && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-sm text-red-400">
                {chapterError}
              </div>
            )}

            {uploadProgress && (
              <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/30 text-sm text-blue-400 flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin flex-shrink-0" />
                {uploadProgress}
              </div>
            )}

            <button
              type="button"
              onClick={onSubmitChapter}
              disabled={chapterLoading}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-[#ff2d55] to-[#ff6b2b] text-[var(--text-primary)] font-semibold text-sm hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <Upload className="w-4 h-4" />
              {chapterLoading ? "กำลังอัปโหลด..." : "อัปโหลดตอน"}
            </button>
          </div>
        )
      )}
    </div>
  );
}
