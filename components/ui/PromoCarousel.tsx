"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { ArrowRight, ChevronLeft, ChevronRight, Coins, PenLine, Smartphone, Sparkles, Languages } from "lucide-react";

type Slide = {
  tag: string;
  title: string;
  sub: string;
  cta: string;
  href: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  platforms?: boolean; // render iOS + Android buttons instead of a single CTA
};

const SLIDES: Slide[] = [
  {
    tag: "อ่านออฟไลน์ได้แล้ววันนี้",
    title: "โหลดเก็บไว้อ่านออฟไลน์",
    sub: "ดาวน์โหลดตอนเก็บไว้อ่านตอนเน็ตไม่มี — ทั้ง iPhone และ Android ฟรี!",
    cta: "โหลดแอป",
    href: "/download",
    icon: Smartphone,
    platforms: true,
  },
  {
    tag: "โปรโมชั่น",
    title: "เติมเหรียญ รับโบนัสทุกแพ็กเกจ",
    sub: "เลือกแพ็กเกจที่ใช่ รับเหรียญโบนัสเพิ่มทันที — ปลดล็อกตอนพรีเมียม + สนับสนุนนักเขียน/นักแปลที่คุณรักโดยตรง",
    cta: "เติมเหรียญ",
    href: "/topup",
    icon: Coins,
  },
  {
    tag: "ใหม่! สำหรับนักเขียน",
    title: "เครื่องมือเขียนระดับโปร",
    sub: "WYSIWYG · ประวัติเวอร์ชัน · Story Bible · สถิติรายเรื่อง · ส่งออก .epub — ชุดเครื่องมือนักเขียนที่ครบกว่าทุกที่ เขียนลื่น เก็บงานปลอดภัย เริ่มฟรีวันนี้",
    cta: "ดูเครื่องมือทั้งหมด",
    href: "/creator-101",
    icon: Sparkles,
  },
  {
    tag: "ใหม่! สำหรับนักแปล",
    title: "เครื่องมือนักแปลระดับโปร",
    sub: "ตัดภาพ manhwa อัตโนมัติ · คลังคำแปล/ชื่อ · พรีวิวก่อนเผยแพร่ · อัปหลายตอนรวด — ชุดเครื่องมือนักแปลที่ทัดเทียมนักเขียน อัปไว แปลเนียน เริ่มฟรีวันนี้",
    cta: "สมัครนักแปลเลย",
    href: "/apply?as=translator",
    icon: Languages,
  },
  {
    tag: "ครีเอเตอร์",
    title: "เปิดรับนักเขียน & นักแปล รุ่นแรก",
    sub: "อนุมัติไว ลงผลงานได้เลย รับส่วนแบ่งรายได้ 80% — รู้ผลเร็ว เริ่มสร้างรายได้จากงานเขียนของคุณ",
    cta: "สมัครเลย",
    href: "/creator-101",
    icon: PenLine,
  },
];

function AppleLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M17.05 12.04c-.03-2.6 2.12-3.85 2.22-3.91-1.21-1.77-3.09-2.01-3.76-2.04-1.6-.16-3.12.94-3.93.94-.81 0-2.06-.92-3.39-.89-1.74.03-3.35 1.01-4.25 2.57-1.81 3.14-.46 7.79 1.3 10.34.86 1.25 1.88 2.65 3.22 2.6 1.29-.05 1.78-.83 3.34-.83 1.56 0 2 .83 3.37.81 1.39-.03 2.27-1.27 3.12-2.53.98-1.45 1.39-2.85 1.41-2.92-.03-.01-2.71-1.04-2.74-4.14M14.53 4.43c.71-.86 1.19-2.06 1.06-3.25-1.02.04-2.26.68-2.99 1.54-.66.76-1.23 1.98-1.08 3.15 1.14.09 2.3-.58 3.01-1.44" />
    </svg>
  );
}

function AndroidLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M6 18c0 .55.45 1 1 1h1v3.5a1.5 1.5 0 0 0 3 0V19h2v3.5a1.5 1.5 0 0 0 3 0V19h1c.55 0 1-.45 1-1V8H6v10M3.5 8A1.5 1.5 0 0 0 2 9.5v7a1.5 1.5 0 0 0 3 0v-7A1.5 1.5 0 0 0 3.5 8m17 0a1.5 1.5 0 0 0-1.5 1.5v7a1.5 1.5 0 0 0 3 0v-7A1.5 1.5 0 0 0 20.5 8m-4.97-5.84l1.3-1.3a.5.5 0 0 0-.71-.71l-1.48 1.48A6.5 6.5 0 0 0 12 1c-.96 0-1.86.23-2.66.63L7.85.15a.5.5 0 0 0-.71.71l1.31 1.3A6.5 6.5 0 0 0 6 7h12a6.5 6.5 0 0 0-2.47-4.84M10 5.25a.75.75 0 1 1 0-1.5.75.75 0 0 1 0 1.5m4 0a.75.75 0 1 1 0-1.5.75.75 0 0 1 0 1.5" />
    </svg>
  );
}

function PlatformButtons() {
  const btn =
    "flex items-center gap-2 px-3.5 py-2 rounded-lg bg-[var(--text-primary)] text-[var(--bg-primary)] hover:opacity-90 transition-opacity";
  return (
    <div className="flex flex-wrap gap-2.5">
      <Link href="/download" className={btn}>
        <AppleLogo className="w-5 h-5 shrink-0" />
        <span className="flex flex-col text-left leading-tight">
          <span className="text-[8px] uppercase tracking-wider opacity-70">iPhone</span>
          <span className="text-xs font-semibold whitespace-nowrap">เพิ่มลงโฮม</span>
        </span>
      </Link>
      <Link href="/download" className={btn}>
        <AndroidLogo className="w-5 h-5 shrink-0" />
        <span className="flex flex-col text-left leading-tight">
          <span className="text-[8px] uppercase tracking-wider opacity-70">Android</span>
          <span className="text-xs font-semibold whitespace-nowrap">โหลด APK</span>
        </span>
      </Link>
    </div>
  );
}

const INTERVAL = 5500;

export default function PromoCarousel() {
  const [i, setI] = useState(0);
  const paused = useRef(false);

  useEffect(() => {
    const id = setInterval(() => {
      if (!paused.current) setI((p) => (p + 1) % SLIDES.length);
    }, INTERVAL);
    return () => clearInterval(id);
  }, []);

  const go = (n: number) => setI((n + SLIDES.length) % SLIDES.length);

  return (
    <section
      className="relative mb-12 overflow-hidden h-80 sm:h-96 lg:h-[440px] border border-[var(--border)] bg-[var(--bg-surface)]"
      onMouseEnter={() => (paused.current = true)}
      onMouseLeave={() => (paused.current = false)}
    >
      {/* subtle monochrome texture */}
      <div className="absolute inset-0 bg-gradient-to-br from-[var(--bg-card)] via-[var(--bg-surface)] to-[var(--bg-primary)]" />
      <div className="absolute inset-4 sm:inset-6 border border-[var(--text-primary)]/15 pointer-events-none" />

      {/* slides (fade) */}
      {SLIDES.map((s, idx) => (
        <div
          key={idx}
          className={`absolute inset-0 transition-opacity duration-700 ${idx === i ? "opacity-100" : "opacity-0 pointer-events-none"}`}
        >
          <div className="relative h-full flex items-center px-8 sm:px-12 lg:px-16">
            {/* big faded illustration — bleeds in from the right (mobile too) */}
            <s.icon
              className="absolute right-[-2.5rem] sm:right-2 top-1/2 -translate-y-1/2 w-56 h-56 sm:w-72 sm:h-72 lg:w-80 lg:h-80 text-[var(--text-primary)] opacity-[0.07] pointer-events-none"
              strokeWidth={1}
            />

            {/* framed focal icon on the right (desktop) — animated */}
            <div className="hidden md:flex absolute right-10 lg:right-20 top-1/2 -translate-y-1/2">
              <div className="relative w-40 h-40 lg:w-52 lg:h-52 flex items-center justify-center">
                <div className="absolute inset-0 rounded-full border border-dashed border-[var(--text-primary)]/25 iv-ring-spin" />
                <div className="absolute inset-5 rounded-full border border-[var(--text-primary)]/10 iv-ring-spin-rev" />
                <s.icon className="w-20 h-20 lg:w-28 lg:h-28 text-[var(--text-primary)] iv-float" strokeWidth={1} />
              </div>
            </div>

            {/* text — rises in each time its slide becomes active */}
            <div className={`relative z-10 max-w-md lg:max-w-lg ${idx === i ? "iv-rise" : ""}`}>
              <p className="eyebrow mb-4">{s.tag}</p>
              <h2
                className={`font-bebas text-[var(--text-primary)] tracking-[0.04em] leading-[0.95] mb-3 uppercase ${
                  s.platforms
                    ? "text-3xl sm:text-4xl lg:text-5xl"
                    : "text-4xl sm:text-5xl lg:text-6xl"
                }`}
              >
                {s.title}
              </h2>
              <p className="text-sm sm:text-base text-[var(--text-secondary)] mb-5 leading-relaxed">
                {s.sub}
              </p>
              {s.platforms ? (
                <PlatformButtons />
              ) : (
                <Link
                  href={s.href}
                  className="inline-flex items-center gap-2 px-7 py-3 bal-btn font-semibold text-xs uppercase tracking-[0.2em] hover:opacity-90"
                >
                  {s.cta}
                  <ArrowRight className="w-4 h-4" />
                </Link>
              )}
            </div>
          </div>
        </div>
      ))}

      {/* arrows */}
      <button
        aria-label="ก่อนหน้า"
        onClick={() => go(i - 1)}
        className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 hidden sm:flex items-center justify-center border border-[var(--border)] bg-[var(--bg-primary)]/60 text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--text-primary)]/50 transition-colors z-10"
      >
        <ChevronLeft className="w-4 h-4" />
      </button>
      <button
        aria-label="ถัดไป"
        onClick={() => go(i + 1)}
        className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 hidden sm:flex items-center justify-center border border-[var(--border)] bg-[var(--bg-primary)]/60 text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--text-primary)]/50 transition-colors z-10"
      >
        <ChevronRight className="w-4 h-4" />
      </button>

      {/* dots */}
      <div className="absolute bottom-6 left-8 sm:left-12 lg:left-16 flex items-center gap-2 z-10">
        {SLIDES.map((_, idx) => (
          <button
            key={idx}
            aria-label={`สไลด์ ${idx + 1}`}
            onClick={() => go(idx)}
            className={`h-1 transition-all ${idx === i ? "w-8 bg-[var(--text-primary)]" : "w-4 bg-[var(--text-primary)]/30 hover:bg-[var(--text-primary)]/60"}`}
          />
        ))}
      </div>
    </section>
  );
}
