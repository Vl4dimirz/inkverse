"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { X, PenTool, Languages, ArrowRight } from "lucide-react";

export default function WelcomePopup({ isCreator }: { isCreator: boolean }) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (isCreator) return;
    try {
      if (localStorage.getItem("ivRecruitSeen")) return;
    } catch {
      return;
    }
    const t = setTimeout(() => setShow(true), 1000);
    return () => clearTimeout(t);
  }, [isCreator]);

  function close() {
    try { localStorage.setItem("ivRecruitSeen", "1"); } catch {}
    setShow(false);
  }

  if (!show) return null;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/75" onClick={close}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative max-w-md w-full bg-[var(--bg-surface)] border border-[var(--border)] p-7 sm:p-8 text-center"
      >
        <button onClick={close} aria-label="ปิด" className="absolute top-3 right-3 w-8 h-8 flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
          <X className="w-4 h-4" />
        </button>

        <p className="text-[11px] uppercase tracking-[0.3em] text-[var(--text-secondary)] mb-2">เปิดรับรุ่นแรก</p>
        <h2 className="font-bebas text-4xl text-[var(--text-primary)] tracking-wide leading-none">
          รับสมัครนักเขียน &amp; นักแปล
        </h2>
        <p className="text-sm text-[var(--text-secondary)] mt-4 leading-relaxed">
          ลงงานกับเรา รับ <span className="text-[var(--text-primary)] font-semibold">80%</span> · สมัครง่าย{" "}
          <span className="text-[var(--text-primary)] font-semibold">รู้ผลใน 5 นาที</span><br />
          เปิดรับครีเอเตอร์รุ่นแรก — มาก่อนได้เปรียบ
        </p>

        <div className="flex flex-col gap-2.5 mt-7">
          <Link href="/apply?as=writer" onClick={close} className="inline-flex items-center justify-center gap-2 px-6 py-3 bal-btn text-sm font-semibold uppercase tracking-widest">
            <PenTool className="w-4 h-4" /> สมัครนักเขียน
          </Link>
          <Link href="/apply?as=translator" onClick={close} className="inline-flex items-center justify-center gap-2 px-6 py-3 border border-[var(--border)] text-[var(--text-primary)] text-sm font-semibold uppercase tracking-widest hover:bg-[var(--bg-card)] transition-colors">
            <Languages className="w-4 h-4" /> สมัครนักแปล
          </Link>
        </div>

        <button onClick={close} className="text-xs text-[var(--text-muted)] mt-5 inline-flex items-center gap-1 hover:text-[var(--text-secondary)]">
          ไว้ทีหลัง <ArrowRight className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
}
