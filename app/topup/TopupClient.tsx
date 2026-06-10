"use client";

import { useState } from "react";
import { Coins, Star, Zap } from "lucide-react";
import { useRouter } from "next/navigation";

interface CoinPackage {
  id: string;
  name: string;
  coins: number;
  price: number;
  bonus: number;
  isPopular: boolean;
}

export default function TopupClient({ packages }: { packages: CoinPackage[] }) {
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
              ? "bg-green-500/10 border border-green-500/30 text-green-400"
              : "bg-red-500/10 border border-red-500/30 text-red-400"
          }`}
        >
          {message.text}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {packages.map((pkg) => {
          const total = pkg.coins + pkg.bonus;
          const isLoading = loading === pkg.id;

          return (
            <div
              key={pkg.id}
              className={`relative bg-[var(--bg-surface)] rounded-2xl border p-5 flex flex-col gap-4 transition-all ${
                pkg.isPopular
                  ? "border-[var(--text-primary)]/50 shadow-lg shadow-[var(--text-primary)]/10"
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

              {/* Package name + coins */}
              <div className="text-center pt-1">
                <p className="text-xs text-[var(--text-secondary)] uppercase tracking-widest mb-1">
                  {pkg.name}
                </p>
                <div className="flex items-center justify-center gap-2">
                  <Coins className="w-8 h-8 text-yellow-400" />
                  <span className="font-bebas text-4xl text-[var(--text-primary)] tracking-wider">
                    {total.toLocaleString()}
                  </span>
                </div>
                {pkg.bonus > 0 && (
                  <div className="flex items-center justify-center gap-1 mt-1">
                    <Zap className="w-3.5 h-3.5 text-green-400" />
                    <span className="text-xs text-green-400 font-medium">
                      {pkg.coins} + โบนัส {pkg.bonus} เหรียญ
                    </span>
                  </div>
                )}
              </div>

              {/* Price */}
              <div className="text-center">
                <p className="text-2xl font-bold text-[var(--text-primary)]">
                  ฿{pkg.price.toFixed(0)}
                </p>
                <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                  ≈ ฿{(pkg.price / total).toFixed(2)} / เหรียญ
                </p>
              </div>

              {/* Buy button */}
              <button
                onClick={() => handleBuy(pkg)}
                disabled={!!loading}
                className={`w-full py-3 rounded-xl font-semibold text-sm transition-all disabled:opacity-50 ${
                  pkg.isPopular
                    ? "bg-[var(--accent)] text-[var(--text-primary)] hover:opacity-90"
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
        * นี่คือระบบทดสอบ การชำระเงินจริงยังไม่เปิดใช้งาน
      </p>
    </div>
  );
}
