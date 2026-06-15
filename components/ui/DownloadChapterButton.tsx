"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { Download, Check, Loader2, X, Smartphone } from "lucide-react";
import { downloadChapter, downloadNovel, removeDownload, isDownloaded, OFFLINE_ENABLED } from "@/lib/offline";

interface Props {
  chapterId: string;
  mangaSlug: string;
  chapterNum: number;
  mangaTitle: string;
  kind: "manga" | "novel";
  // manga
  pages?: { src: string; width?: number | null; height?: number | null }[];
  // novel
  html?: string;
  chapterTitle?: string | null;
  minutes?: number;
  authorNote?: string | null;
}

// In the app: saves the chapter for offline reading (manga images or novel text).
// On the web: the button still shows, but tapping invites the visitor to get the
// app — a soft, non-blocking nudge to install (offline is app-exclusive).
export default function DownloadChapterButton({
  chapterId,
  mangaSlug,
  chapterNum,
  mangaTitle,
  kind,
  pages,
  html,
  chapterTitle,
  minutes,
  authorNote,
}: Props) {
  const [inApp, setInApp] = useState(false);
  const [state, setState] = useState<"idle" | "downloading" | "done">("idle");
  const [progress, setProgress] = useState(0);
  const [invite, setInvite] = useState(false);

  useEffect(() => {
    setInApp(!!(window as unknown as { Capacitor?: unknown }).Capacitor);
    try {
      if (isDownloaded(chapterId)) setState("done");
    } catch {}
  }, [chapterId]);

  if (!OFFLINE_ENABLED) return null;

  const onClick = async () => {
    if (!inApp) {
      setInvite(true);
      return;
    }
    if (state === "downloading") return;
    if (state === "done") {
      await removeDownload(chapterId);
      setState("idle");
      return;
    }
    setState("downloading");
    setProgress(0);
    try {
      if (kind === "novel") {
        await downloadNovel({
          chapterId,
          mangaSlug,
          chapterNum,
          mangaTitle,
          html: html || "",
          chapterTitle,
          minutes,
          authorNote,
        });
      } else {
        await downloadChapter(
          { chapterId, mangaSlug, chapterNum, mangaTitle },
          pages || [],
          (d, t) => setProgress(Math.round((d / t) * 100))
        );
      }
      setState("done");
    } catch {
      setState("idle");
      alert("ดาวน์โหลดไม่สำเร็จ ลองใหม่อีกครั้ง");
    }
  };

  return (
    <>
      <button
        onClick={onClick}
        title={state === "done" ? "ดาวน์โหลดแล้ว (แตะเพื่อลบ)" : "ดาวน์โหลดไว้อ่านออฟไลน์"}
        className="flex items-center gap-1.5 px-2.5 py-2 rounded-lg hover:bg-current/10 transition-colors text-xs opacity-70 hover:opacity-100"
      >
        {state === "downloading" ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            {kind === "manga" && <span>{progress}%</span>}
          </>
        ) : state === "done" ? (
          <Check className="w-4 h-4" />
        ) : (
          <Download className="w-4 h-4" />
        )}
      </button>

      {/* Web-only soft upsell — portalled to <body> so it floats above the navbar */}
      {invite &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 px-4"
            onClick={() => setInvite(false)}
          >
          <div
            className="w-full max-w-sm bg-[var(--bg-surface)] border border-[var(--border)] rounded-2xl p-6 text-center relative text-[var(--text-primary)]"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setInvite(false)}
              className="absolute top-3 right-3 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              aria-label="ปิด"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="w-14 h-14 mx-auto mb-4 flex items-center justify-center rounded-full bg-[var(--text-primary)] text-[var(--bg-primary)]">
              <Smartphone className="w-7 h-7" />
            </div>
            <h3 className="font-bebas text-2xl tracking-wider">อ่านออฟไลน์ได้ในแอป</h3>
            <p className="text-sm text-[var(--text-secondary)] mt-2 leading-relaxed">
              ดาวน์โหลดตอนเก็บไว้อ่านตอนเน็ตไม่มี/บนเครื่องบิน — ใช้ได้เฉพาะในแอป INKVERSE
              บน Android (ฟรี)
            </p>
            <Link
              href="/download"
              className="inline-flex items-center justify-center gap-2 mt-5 w-full py-3 rounded-xl bal-btn text-sm font-semibold uppercase tracking-widest"
            >
              <Download className="w-4 h-4" />
              โหลดแอป
            </Link>
          </div>
          </div>,
          document.body
        )}
    </>
  );
}
