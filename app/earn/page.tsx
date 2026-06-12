import Link from "next/link";
import { CalendarCheck, Smartphone, UserPlus, Gift, Zap, ArrowRight, Coins } from "lucide-react";
import { DAILY_CHECKIN_BASE, DAILY_CHECKIN_STREAK_BONUS, REFERRAL_REWARD_COINS, SIGNUP_BONUS_COINS } from "@/lib/coins";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "หาเหรียญฟรี — ปลดล็อกตอนที่ชอบ | INKVERSE",
  description: "วิธีรับเหรียญฟรีบน INKVERSE: เช็คอินรายวัน โหลดแอป ชวนเพื่อน รับเหรียญไปปลดล็อกตอนพรีเมียม",
};

const APP_BONUS = 20;

const WAYS = [
  {
    icon: CalendarCheck,
    coins: `+${DAILY_CHECKIN_BASE}/วัน`,
    title: "เช็คอินรายวัน",
    body: `รับ ${DAILY_CHECKIN_BASE} เหรียญทุกวันที่เข้าเว็บ · เช็คอินครบ 7 วันติด รับโบนัส +${DAILY_CHECKIN_STREAK_BONUS} เหรียญ`,
    href: "/",
    cta: "เช็คอินที่หน้าแรก",
  },
  {
    icon: Smartphone,
    coins: `+${APP_BONUS}`,
    title: "โหลดแอป Android",
    body: "ติดตั้งแอป + ล็อกอินครั้งแรก รับ 20 เหรียญฟรี (ครั้งเดียว) — แถมอ่านแบบกันแคป",
    href: "/download",
    cta: "ดาวน์โหลดแอป",
  },
  {
    icon: UserPlus,
    coins: `+${REFERRAL_REWARD_COINS}`,
    title: "ชวนเพื่อน",
    body: `แชร์ลิงก์ชวนเพื่อน — พอเพื่อนเติมเงินครั้งแรก คุณและเพื่อนรับคนละ ${REFERRAL_REWARD_COINS} เหรียญ`,
    href: "/referral",
    cta: "รับลิงก์ชวนเพื่อน",
  },
  {
    icon: Gift,
    coins: `+${SIGNUP_BONUS_COINS}`,
    title: "สมัครสมาชิก",
    body: `สมาชิกใหม่รับ ${SIGNUP_BONUS_COINS} เหรียญต้อนรับทันที (รับครั้งเดียวตอนสมัคร)`,
    href: "/auth/signup",
    cta: "สมัครสมาชิก",
  },
  {
    icon: Zap,
    coins: "2 เท่า",
    title: "เติมเหรียญครั้งแรก",
    body: "เติมเหรียญครั้งแรกรับโบนัส 2 เท่าทันที — คุ้มสุดสำหรับนักอ่านตัวจริง",
    href: "/topup",
    cta: "เติมเหรียญ",
  },
];

export default function EarnPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12">
      <div className="text-center mb-10">
        <p className="eyebrow text-[var(--text-secondary)]">FREE COINS</p>
        <h1 className="font-bebas text-5xl sm:text-6xl text-[var(--text-primary)] tracking-wider leading-[0.95] flex items-center justify-center gap-3">
          <Coins className="w-9 h-9" /> หาเหรียญฟรี
        </h1>
        <p className="text-[var(--text-secondary)] mt-4 max-w-lg mx-auto">
          เอาเหรียญไปปลดล็อกตอนพรีเมียมที่ชอบ — มีหลายวิธีให้เก็บฟรี ไม่ต้องจ่ายเงินก็อ่านได้
        </p>
      </div>

      <div className="space-y-3">
        {WAYS.map(({ icon: Icon, coins, title, body, href, cta }) => (
          <div key={title} className="flex flex-col sm:flex-row sm:items-center gap-4 border border-[var(--border)] bg-[var(--bg-surface)] p-5">
            <div className="flex items-center gap-4 flex-1 min-w-0">
              <div className="w-12 h-12 shrink-0 flex items-center justify-center bg-[var(--text-primary)] text-[var(--bg-primary)]">
                <Icon className="w-6 h-6" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-[var(--text-primary)]">{title}</h3>
                  <span className="text-[11px] font-bold px-2 py-0.5 bg-[var(--text-primary)] text-[var(--bg-primary)] rounded">{coins} เหรียญ</span>
                </div>
                <p className="text-xs text-[var(--text-secondary)] mt-1 leading-relaxed">{body}</p>
              </div>
            </div>
            <Link
              href={href}
              className="shrink-0 inline-flex items-center justify-center gap-1.5 px-4 py-2.5 bal-btn text-xs font-semibold uppercase tracking-widest"
            >
              {cta} <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        ))}
      </div>

      <p className="text-center text-xs text-[var(--text-muted)] mt-8">
        ยิ่งมีส่วนร่วม ยิ่งได้เหรียญเยอะ — เก็บไปปลดล็อกตอนใหม่ของเรื่องที่ติดตามได้เลย
      </p>
    </div>
  );
}
