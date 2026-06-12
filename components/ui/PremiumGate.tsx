"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Lock, Coins, ArrowLeft, Zap } from "lucide-react";

interface PremiumGateProps {
  chapterId: string;
  chapterNum: number;
  coinCost: number;
  userCoins: number;
  mangaTitle: string;
  mangaSlug: string;
  freeAt?: string | null;
}

export default function PremiumGate({
  chapterId,
  chapterNum,
  coinCost,
  userCoins,
  mangaTitle,
  mangaSlug,
  freeAt,
}: PremiumGateProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canAfford = userCoins >= coinCost;

  const freeDate = freeAt ? new Date(freeAt) : null;
  const earlyAccess = !!freeDate && freeDate.getTime() > Date.now();
  let freeIn: string | null = null;
  if (earlyAccess && freeDate) {
    const ms = freeDate.getTime() - Date.now();
    const d = Math.floor(ms / 86400000);
    const h = Math.floor((ms % 86400000) / 3600000);
    freeIn = d > 0 ? `${d} วัน${h > 0 ? ` ${h} ชม.` : ""}` : h > 0 ? `${h} ชม.` : "ไม่ถึงชั่วโมง";
  }

  async function handleUnlock() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/coin/unlock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chapterId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(
          data.error === "INSUFFICIENT_COINS"
            ? "เหรียญไม่พอ กรุณาเติมเหรียญก่อน"
            : "เกิดข้อผิดพลาด กรุณาลองใหม่"
        );
        return;
      }
      router.refresh();
    } catch {
      setError("เกิดข้อผิดพลาด กรุณาลองใหม่");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* Back link */}
        <Link
          href={`/content/${mangaSlug}`}
          className="inline-flex items-center gap-2 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors mb-8"
        >
          <ArrowLeft className="w-4 h-4" />
          {mangaTitle}
        </Link>

        <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-3xl overflow-hidden">
          {/* Icon banner */}
          <div className="bg-gradient-to-br from-[var(--bg-card)] to-[var(--bg-surface)] border-b border-[var(--border)] p-8 text-center">
            <div className="w-20 h-20 rounded-full bg-[var(--bg-card)] border-2 border-[var(--border)] flex items-center justify-center mx-auto mb-4">
              <Lock className="w-9 h-9 text-[var(--text-primary)]" />
            </div>
            <h1 className="font-bebas text-3xl text-[var(--text-primary)] tracking-wider">
              {earlyAccess ? "อ่านล่วงหน้า" : "ตอน Premium"}
            </h1>
            <p className="text-[var(--text-secondary)] text-sm mt-1">
              {earlyAccess
                ? `ตอนที่ ${chapterNum} · จะเปิดให้อ่านฟรีในอีก ${freeIn} — หรือใช้เหรียญอ่านเลยตอนนี้`
                : `ตอนที่ ${chapterNum} ต้องใช้เหรียญเพื่อปลดล็อก`}
            </p>
          </div>

          <div className="p-6 space-y-4">
            {/* Cost row */}
            <div className="flex items-center justify-between bg-[var(--bg-card)] rounded-xl px-4 py-3">
              <div className="flex items-center gap-2 text-[var(--text-secondary)]">
                <Zap className="w-4 h-4 text-[var(--text-primary)]" />
                <span className="text-sm">ราคา</span>
              </div>
              <div className="flex items-center gap-1.5 text-[var(--text-primary)] font-semibold">
                <Coins className="w-4 h-4" />
                <span>{coinCost} เหรียญ</span>
              </div>
            </div>

            {/* Balance row */}
            <div className="flex items-center justify-between bg-[var(--bg-card)] rounded-xl px-4 py-3">
              <span className="text-sm text-[var(--text-secondary)]">เหรียญของคุณ</span>
              <div
                className={`flex items-center gap-1.5 font-semibold ${
                  canAfford ? "text-[var(--text-primary)]" : "text-[var(--text-primary)]"
                }`}
              >
                <Coins className="w-4 h-4" />
                <span>{userCoins} เหรียญ</span>
              </div>
            </div>

            {!canAfford && (
              <p className="text-sm text-[var(--text-primary)] bg-[var(--bg-card)] rounded-xl px-4 py-3 text-center">
                เหรียญไม่พอ ต้องการอีก {coinCost - userCoins} เหรียญ
              </p>
            )}

            {error && (
              <p className="text-sm text-[var(--text-primary)] bg-[var(--bg-card)] rounded-xl px-4 py-3 text-center">
                {error}
              </p>
            )}

            {/* CTA */}
            <div className="flex flex-col gap-2 pt-2">
              {canAfford ? (
                <button
                  onClick={handleUnlock}
                  disabled={loading}
                  className="w-full py-3.5 rounded-xl bal-btn font-semibold hover:opacity-90 transition-colors disabled:opacity-50"
                >
                  {loading ? "กำลังปลดล็อก..." : `ปลดล็อกด้วย ${coinCost} เหรียญ`}
                </button>
              ) : (
                <Link
                  href="/topup"
                  className="w-full py-3.5 rounded-xl bg-[var(--text-primary)] text-black font-semibold text-center hover:bg-[var(--bg-surface)] transition-colors"
                >
                  เติมเหรียญ
                </Link>
              )}
              <Link
                href={`/content/${mangaSlug}`}
                className="w-full py-3 rounded-xl bg-[var(--bg-card)] border border-[var(--border)] text-[var(--text-primary)] text-sm text-center hover:border-white/30 transition-colors"
              >
                กลับไปหน้าเรื่อง
              </Link>
            </div>

            {/* Earn free coins instead of paying */}
            <div className="border-t border-[var(--border)] pt-4">
              <p className="text-xs text-[var(--text-secondary)] text-center mb-2.5">ไม่อยากจ่าย? เก็บเหรียญฟรีได้:</p>
              <div className="flex flex-wrap justify-center gap-2">
                {[
                  { href: "/", label: "เช็คอิน +2/วัน" },
                  { href: "/download", label: "โหลดแอป +20" },
                  { href: "/referral", label: "ชวนเพื่อน +50" },
                ].map((o) => (
                  <Link
                    key={o.href}
                    href={o.href}
                    className="px-2.5 py-1 rounded-lg bg-[var(--bg-card)] border border-[var(--border)] text-[11px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--text-primary)]/40 transition-colors"
                  >
                    {o.label}
                  </Link>
                ))}
              </div>
              <Link href="/earn" className="block text-center text-xs text-[var(--text-primary)] underline mt-2.5">
                ดูวิธีหาเหรียญฟรีทั้งหมด
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
