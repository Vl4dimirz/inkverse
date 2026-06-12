"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { ArrowRight, ChevronLeft, ChevronRight, Coins, PenLine, Smartphone, Users } from "lucide-react";

type Slide = {
  tag: string;
  title: string;
  sub: string;
  cta: string;
  href: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
};

const SLIDES: Slide[] = [
  {
    tag: "โปรโมชั่น",
    title: "เติมครั้งแรกวันนี้ รับเหรียญโบนัสทันที",
    sub: "เติมครั้งแรกรับโบนัสเหรียญทันที — ปลดล็อกตอนพรีเมียม + สนับสนุนนักเขียน/นักแปลที่คุณรักโดยตรง",
    cta: "เติมเหรียญ",
    href: "/topup",
    icon: Coins,
  },
  {
    tag: "ครีเอเตอร์",
    title: "เปิดรับนักเขียน & นักแปล รุ่นแรก",
    sub: "อนุมัติไว ลงผลงานได้เลย รับส่วนแบ่งรายได้ 80% — รู้ผลเร็ว เริ่มสร้างรายได้จากงานเขียนของคุณ",
    cta: "สมัครเลย",
    href: "/creator-101",
    icon: PenLine,
  },
  {
    tag: "แอป ANDROID",
    title: "โหลดแอปวันนี้ รับ 20 เหรียญฟรี",
    sub: "อ่านลื่นกว่าเว็บ กันแคปหน้าจอ + แจ้งเตือนตอนใหม่ทันที — ติดตั้งแล้วรับเหรียญฟรีเลย",
    cta: "โหลดแอป",
    href: "/download",
    icon: Smartphone,
  },
  {
    tag: "ชวนเพื่อน",
    title: "ชวนเพื่อนมาอ่าน รับเหรียญฟรีทั้งคู่",
    sub: "แชร์ลิงก์ชวนเพื่อนของคุณ เพื่อนสมัครแล้วเติมครั้งแรก = ได้เหรียญกันทั้งคู่ ยิ่งชวนยิ่งได้",
    cta: "ชวนเพื่อน",
    href: "/earn",
    icon: Users,
  },
];

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

            {/* framed focal icon on the right (desktop) */}
            <div className="hidden md:flex absolute right-10 lg:right-20 top-1/2 -translate-y-1/2">
              <div className="relative w-40 h-40 lg:w-52 lg:h-52 flex items-center justify-center">
                <div className="absolute inset-0 rounded-full border border-[var(--text-primary)]/20" />
                <div className="absolute inset-5 rounded-full border border-[var(--text-primary)]/10" />
                <s.icon className="w-20 h-20 lg:w-28 lg:h-28 text-[var(--text-primary)]" strokeWidth={1} />
              </div>
            </div>

            {/* text */}
            <div className="relative z-10 max-w-md lg:max-w-lg">
              <p className="eyebrow mb-4">{s.tag}</p>
              <h2 className="font-bebas text-4xl sm:text-5xl lg:text-6xl text-[var(--text-primary)] tracking-[0.04em] leading-[0.95] mb-4 uppercase">
                {s.title}
              </h2>
              <p className="text-sm sm:text-base text-[var(--text-secondary)] mb-6 leading-relaxed">
                {s.sub}
              </p>
              <Link
                href={s.href}
                className="inline-flex items-center gap-2 px-7 py-3 bal-btn font-semibold text-xs uppercase tracking-[0.2em] hover:opacity-90"
              >
                {s.cta}
                <ArrowRight className="w-4 h-4" />
              </Link>
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
