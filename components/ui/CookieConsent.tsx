"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Cookie } from "lucide-react";

// PDPA-friendly cookie notice. Essential cookies (login, age gate) always run;
// the choice here only governs non-essential analytics (see TrafficBeacon).
export default function CookieConsent() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    try {
      if (!localStorage.getItem("ivCookieConsent")) setShow(true);
    } catch {
      /* storage blocked → just don't show */
    }
  }, []);

  const choose = (v: "all" | "essential") => {
    try {
      localStorage.setItem("ivCookieConsent", v);
    } catch {}
    setShow(false);
  };

  if (!show) return null;

  return (
    <div className="fixed bottom-0 inset-x-0 z-[90] bg-[var(--bg-surface)] border-t border-[var(--border)]">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-6">
        <div className="flex gap-3 flex-1 min-w-0">
          <Cookie className="w-5 h-5 text-[var(--text-primary)] shrink-0 mt-0.5" />
          <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
            เราใช้คุกกี้ที่จำเป็นเพื่อให้เว็บทำงาน (เช่น เข้าสู่ระบบ) และคุกกี้วิเคราะห์เพื่อพัฒนาประสบการณ์การอ่าน
            อ่านเพิ่มเติมได้ที่{" "}
            <Link href="/privacy" className="text-[var(--text-primary)] underline hover:no-underline">
              นโยบายความเป็นส่วนตัว
            </Link>
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => choose("essential")}
            className="px-4 py-2 text-xs font-semibold uppercase tracking-wider border border-[var(--border)] text-[var(--text-primary)] hover:bg-white/5 transition-colors whitespace-nowrap"
          >
            จำเป็นเท่านั้น
          </button>
          <button
            onClick={() => choose("all")}
            className="px-4 py-2 text-xs font-semibold uppercase tracking-wider bal-btn whitespace-nowrap"
          >
            ยอมรับทั้งหมด
          </button>
        </div>
      </div>
    </div>
  );
}
