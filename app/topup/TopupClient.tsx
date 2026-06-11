"use client";

import { useState } from "react";
import { Coins, Star, Zap, Crown } from "lucide-react";
import { useRouter } from "next/navigation";

interface CoinPackage {
  id: string;
  name: string;
  coins: number;
  price: number;
  bonus: number;
  vipDays: number;
  isPopular: boolean;
}

// Rough average cost of a premium chapter, used only to show a "per chapter"
// price hint so larger packs read as better value.
const AVG_COINS_PER_CHAPTER = 10;

export default function TopupClient({
  packages,
  firstTopup = false,
}: {
  packages: CoinPackage[];
  firstTopup?: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  async function handleBuy(pkg: CoinPackage) {
    setLoading(pkg.id);
    setMessage(null);
    try {
      const res = await fetch("/api/coin/order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ packageId: pkg.id }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage({ type: "error", text: "เกิดข้อผิดพลาด กรุณาลองใหม่" });
        return;
      }
      router.push(`/topup/checkout/${data.orderId}`);
    } catch {
      setMessage({ type: "error", text: "เกิดข้อผิดพลาด กรุณาลองใหม่" });
    } finally {
      setLoading(null);
    }
  }

  return (
    <div>
      {message && (
        <div
          className={`mb-6 px-4 py-3 rounded-xl text-sm text-center ${
            message.type === "success"
              ? "bg-[var(--bg-card)] border border-[var(--border)] text-[var(--text-primary)]"
              : "bg-[var(--bg-card)] border border-[var(--border)] text-[var(--text-primary)]"
          }`}
        >
          {message.text}
        </div>
      )}

      {/* First-top-up promo banner */}
      {firstTopup && (
        <div className="mb-6 flex items-center justify-center gap-2 px-4 py-3 bg-[var(--text-primary)] text-[var(--bg-primary)] text-sm font-semibold uppercase tracking-widest">
          <Zap className="w-4 h-4" />
          เติมครั้งแรก รับเหรียญ 2 เท่าทันที
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {packages.map((pkg) => {
          const total = pkg.coins + pkg.bonus;
          // First top-up doubles the purchase: base coins are credited again.
          const effectiveTotal = firstTopup ? total + pkg.coins : total;
          const perChapter = pkg.price / (effectiveTotal / AVG_COINS_PER_CHAPTER);
          const isLoading = loading === pkg.id;

          const isVip = pkg.vipDays > 0;
          return (
            <div
              key={pkg.id}
              className={`relative bg-[var(--bg-surface)] rounded-2xl border p-5 flex flex-col gap-4 transition-all ${
                pkg.isPopular || isVip
                  ? "border-[var(--text-primary)]/50  "
                  : "border-[var(--border)] hover:border-white/15"
              }`}
            >
              {/* Popular badge */}
              {pkg.isPopular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-[var(--accent)] rounded-full text-xs font-semibold text-[var(--text-primary)] flex items-center gap-1">
                  <Star className="w-3 h-3 fill-white" />
                  ยอดนิยม
                </div>
              )}
              {/* VIP badge */}
              {isVip && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-[var(--text-primary)] text-[var(--bg-primary)] text-xs font-semibold flex items-center gap-1 uppercase tracking-widest">
                  <Crown className="w-3 h-3" />
                  VIP
                </div>
              )}

              {/* Package name + coins */}
              <div className="text-center pt-1">
                <p className="text-xs text-[var(--text-secondary)] uppercase tracking-widest mb-1">
                  {pkg.name}
                </p>
                <div className="flex items-center justify-center gap-2">
                  <Coins className="w-8 h-8 text-[var(--text-primary)]" />
                  <span className="font-bebas text-4xl text-[var(--text-primary)] tracking-wider">
                    {effectiveTotal.toLocaleString()}
                  </span>
                </div>
                {firstTopup ? (
                  <div className="flex items-center justify-center gap-1 mt-1">
                    <Zap className="w-3.5 h-3.5 text-[var(--text-primary)]" />
                    <span className="text-xs text-[var(--text-primary)] font-medium">
                      <span className="line-through text-[var(--text-muted)]">{total.toLocaleString()}</span>{" "}
                      × 2 โบนัสครั้งแรก
                    </span>
                  </div>
                ) : (
                  pkg.bonus > 0 && (
                    <div className="flex items-center justify-center gap-1 mt-1">
                      <Zap className="w-3.5 h-3.5 text-[var(--text-primary)]" />
                      <span className="text-xs text-[var(--text-primary)] font-medium">
                        {pkg.coins} + โบนัส {pkg.bonus} เหรียญ
                      </span>
                    </div>
                  )
                )}
              </div>

              {/* VIP benefits */}
              {isVip && (
                <div className="text-center border border-[var(--border)] py-2 text-xs text-[var(--text-primary)] font-medium uppercase tracking-wide">
                  VIP {pkg.vipDays} วัน · ลดปลดล็อก 10%
                </div>
              )}

              {/* Price */}
              <div className="text-center">
                <p className="text-2xl font-bold text-[var(--text-primary)]">
                  ฿{pkg.price.toFixed(0)}
                </p>
                <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                  {isVip ? `${pkg.coins} เหรียญ + สิทธิ์ VIP` : `≈ ฿${perChapter.toFixed(1)} / ตอน`}
                </p>
              </div>

              {/* Buy button */}
              <button
                onClick={() => handleBuy(pkg)}
                disabled={!!loading}
                className={`w-full py-3 rounded-xl font-semibold text-sm transition-all disabled:opacity-50 ${
                  pkg.isPopular
                    ? "bal-btn hover:opacity-90"
                    : "bg-[var(--bg-card)] border border-[var(--border)] text-[var(--text-primary)] hover:border-white/30"
                }`}
              >
                {isLoading ? "กำลังดำเนินการ..." : `ซื้อ ฿${pkg.price.toFixed(0)}`}
              </button>
            </div>
          );
        })}
      </div>

      <p className="text-xs text-[var(--text-muted)] text-center mt-6">
        ชำระด้วย PromptPay — สแกน QR แล้วแนบสลิป ระบบยืนยันอัตโนมัติทันที
        <br />
        <span className="opacity-70">บัตรเครดิต/เดบิต · Mobile Banking · TrueMoney/ShopeePay — เร็วๆ นี้</span>
      </p>
    </div>
  );
}
