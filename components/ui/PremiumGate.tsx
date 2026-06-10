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
}

export default function PremiumGate({
  chapterId,
  chapterNum,
  coinCost,
  userCoins,
  mangaTitle,
  mangaSlug,
}: PremiumGateProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canAfford = userCoins >= coinCost;

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
          <div className="bg-gradient-to-br from-yellow-500/10 to-orange-500/10 border-b border-[var(--border)] p-8 text-center">
            <div className="w-20 h-20 rounded-full bg-yellow-500/20 border-2 border-yellow-500/40 flex items-center justify-center mx-auto mb-4">
              <Lock className="w-9 h-9 text-yellow-400" />
            </div>
            <h1 className="font-bebas text-3xl text-[var(--text-primary)] tracking-wider">
              ตอน Premium
            </h1>
            <p className="text-[var(--text-secondary)] text-sm mt-1">
              ตอนที่ {chapterNum} ต้องใช้เหรียญเพื่อปลดล็อก
            </p>
          </div>

          <div className="p-6 space-y-4">
            {/* Cost row */}
            <div className="flex items-center justify-between bg-[var(--bg-card)] rounded-xl px-4 py-3">
              <div className="flex items-center gap-2 text-[var(--text-secondary)]">
                <Zap className="w-4 h-4 text-yellow-400" />
                <span className="text-sm">ราคา</span>
              </div>
              <div className="flex items-center gap-1.5 text-yellow-400 font-semibold">
                <Coins className="w-4 h-4" />
                <span>{coinCost} เหรียญ</span>
              </div>
            </div>

            {/* Balance row */}
            <div className="flex items-center justify-between bg-[var(--bg-card)] rounded-xl px-4 py-3">
              <span className="text-sm text-[var(--text-secondary)]">เหรียญของคุณ</span>
              <div
                className={`flex items-center gap-1.5 font-semibold ${
                  canAfford ? "text-green-400" : "text-red-400"
                }`}
              >
                <Coins className="w-4 h-4" />
                <span>{userCoins} เหรียญ</span>
              </div>
            </div>

            {!canAfford && (
              <p className="text-sm text-red-400 bg-red-500/10 rounded-xl px-4 py-3 text-center">
                เหรียญไม่พอ ต้องการอีก {coinCost - userCoins} เหรียญ
              </p>
            )}

            {error && (
              <p className="text-sm text-red-400 bg-red-500/10 rounded-xl px-4 py-3 text-center">
                {error}
              </p>
            )}

            {/* CTA */}
            <div className="flex flex-col gap-2 pt-2">
              {canAfford ? (
                <button
                  onClick={handleUnlock}
                  disabled={loading}
                  className="w-full py-3.5 rounded-xl bg-[var(--accent)] text-[var(--text-primary)] font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  {loading ? "กำลังปลดล็อก..." : `ปลดล็อกด้วย ${coinCost} เหรียญ`}
                </button>
              ) : (
                <Link
                  href="/topup"
                  className="w-full py-3.5 rounded-xl bg-yellow-500 text-black font-semibold text-center hover:bg-yellow-400 transition-colors"
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
          </div>
        </div>
      </div>
    </div>
  );
}
