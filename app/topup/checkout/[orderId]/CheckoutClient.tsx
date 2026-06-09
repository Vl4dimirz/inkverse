"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Coins, CreditCard, Smartphone, ShieldCheck, ArrowLeft,
  AlertCircle, Lock, Loader2, RefreshCw, Wallet,
} from "lucide-react";
import clsx from "clsx";

interface Order {
  id: string;
  coins: number;
  bonus: number;
  price: number;
  packageName: string;
}

type Method = "CARD" | "PROMPTPAY" | "MOBILE_BANKING" | "TRUEMONEY" | "SHOPEEPAY";

const TABS: { id: Method; label: string; icon: React.ReactNode }[] = [
  { id: "CARD", label: "บัตรเครดิต", icon: <CreditCard className="w-4 h-4" /> },
  { id: "PROMPTPAY", label: "PromptPay", icon: <Smartphone className="w-4 h-4" /> },
  { id: "MOBILE_BANKING", label: "Mobile Banking", icon: <Smartphone className="w-4 h-4" /> },
  { id: "TRUEMONEY", label: "TrueMoney", icon: <Wallet className="w-4 h-4" /> },
  { id: "SHOPEEPAY", label: "ShopeePay", icon: <Wallet className="w-4 h-4" /> },
];

const BANKS = [
  { id: "kbank", label: "KBank", sub: "K-Plus", bg: "#0d5c1e", color: "#4ade80" },
  { id: "scb",   label: "SCB",   sub: "SCB Easy",          bg: "#2d1750", color: "#c084fc" },
  { id: "bbl",   label: "BBL",   sub: "Bualuang mBanking", bg: "#112454", color: "#60a5fa" },
  { id: "bay",   label: "BAY",   sub: "KMA",               bg: "#5c4500", color: "#fbbf24" },
  { id: "ktb",   label: "KTB",   sub: "Krungthai NEXT",    bg: "#004d73", color: "#38bdf8" },
];

function formatCard(val: string) {
  return val.replace(/\D/g, "").slice(0, 16).replace(/(.{4})/g, "$1 ").trim();
}
function formatExpiry(val: string) {
  const d = val.replace(/\D/g, "").slice(0, 4);
  return d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d;
}

declare global {
  interface Window {
    Omise?: {
      setPublicKey: (key: string) => void;
      createToken: (
        type: string,
        card: {
          name: string;
          number: string;
          expiration_month: string;
          expiration_year: string;
          security_code: string;
        },
        callback: (status: number, resp: { id?: string; message?: string }) => void
      ) => void;
    };
  }
}

export default function CheckoutClient({
  order,
  userCoins,
  isSandbox,
  omisePublicKey,
}: {
  order: Order;
  userCoins: number;
  isSandbox: boolean;
  omisePublicKey?: string;
}) {
  const router = useRouter();
  const total = order.coins + order.bonus;

  const [method, setMethod] = useState<Method>("CARD");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Card fields
  const [cardNum, setCardNum] = useState("");
  const [expiry, setExpiry] = useState("");
  const [cvv, setCvv] = useState("");
  const [name, setName] = useState("");

  // PromptPay
  const [qrUrl, setQrUrl] = useState<string | null>(null);
  const [qrLoading, setQrLoading] = useState(false);
  const [polling, setPolling] = useState(false);

  // Mobile banking bank selection
  const [selectedBank, setSelectedBank] = useState<string>("");

  const [omiseReady, setOmiseReady] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!omisePublicKey) return;
    const script = document.createElement("script");
    script.src = "https://cdn.omise.co/omise.js";
    script.async = true;
    script.onload = () => setOmiseReady(true);
    document.head.appendChild(script);
    return () => { document.head.removeChild(script); };
  }, [omisePublicKey]);

  useEffect(() => {
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  function startPolling() {
    setPolling(true);
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/coin/order/${order.id}/status`);
        if (res.ok) {
          const data = await res.json();
          if (data.status === "PAID") {
            clearInterval(pollRef.current!);
            router.push(`/topup/success/${order.id}`);
          }
        }
      } catch { /* ignore */ }
    }, 3000);
  }

  async function loadPromptPayQR() {
    setQrLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/coin/order/${order.id}/promptpay`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "ไม่สามารถสร้าง QR ได้"); return; }
      setQrUrl(data.qrProxyUrl ?? null);
      if (!data.sandbox) startPolling();
    } finally {
      setQrLoading(false);
    }
  }

  async function chargeCard(omiseToken?: string) {
    try {
      const res = await fetch(`/api/coin/order/${order.id}/pay`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ method: "CARD", omiseToken }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(d.error ?? "เกิดข้อผิดพลาด กรุณาลองใหม่");
        return;
      }
      router.push(`/topup/success/${order.id}`);
    } catch {
      setError("เกิดข้อผิดพลาด กรุณาลองใหม่");
    } finally {
      setLoading(false);
    }
  }

  async function handleRedirectPay(sourceType: string) {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/coin/order/${order.id}/redirect-pay`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: sourceType }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "เกิดข้อผิดพลาด กรุณาลองใหม่"); return; }
      window.location.href = data.authorizeUri;
    } catch {
      setError("เกิดข้อผิดพลาด กรุณาลองใหม่");
      setLoading(false);
    }
  }

  async function handlePay() {
    setError("");

    if (method === "PROMPTPAY") {
      if (isSandbox) {
        setLoading(true);
        try {
          const res = await fetch(`/api/coin/order/${order.id}/pay`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ method: "PROMPTPAY" }),
          });
          if (res.ok) router.push(`/topup/success/${order.id}`);
          else setError("เกิดข้อผิดพลาด");
        } finally { setLoading(false); }
      } else {
        await loadPromptPayQR();
      }
      return;
    }

    if (method === "MOBILE_BANKING") {
      if (!selectedBank) { setError("กรุณาเลือกธนาคาร"); return; }
      await handleRedirectPay(`mobile_banking_${selectedBank}`);
      return;
    }

    if (method === "TRUEMONEY") {
      await handleRedirectPay("truemoney_jumpapp");
      return;
    }

    if (method === "SHOPEEPAY") {
      await handleRedirectPay("shopeepay_jumpapp");
      return;
    }

    // CARD
    if (cardNum.replace(/\s/g, "").length < 16) return setError("กรุณากรอกหมายเลขบัตรให้ครบ 16 หลัก");
    if (expiry.length < 5) return setError("กรุณากรอกวันหมดอายุ");
    if (cvv.length < 3) return setError("กรุณากรอก CVV");
    if (!name.trim()) return setError("กรุณากรอกชื่อบนบัตร");

    setLoading(true);

    if (omisePublicKey && omiseReady && window.Omise) {
      const [mm, yy] = expiry.split("/");
      window.Omise.setPublicKey(omisePublicKey);
      window.Omise.createToken(
        "card",
        {
          name,
          number: cardNum.replace(/\s/g, ""),
          expiration_month: mm,
          expiration_year: yy?.length === 2 ? `20${yy}` : yy,
          security_code: cvv,
        },
        async (statusCode, resp) => {
          if (statusCode !== 200 || !resp.id) {
            setError(resp.message ?? "ข้อมูลบัตรไม่ถูกต้อง");
            setLoading(false);
            return;
          }
          await chargeCard(resp.id);
        }
      );
      return;
    }

    await chargeCard(undefined);
  }

  const isQrShowing = method === "PROMPTPAY" && qrUrl && !isSandbox;
  const buttonLabel = () => {
    if (method === "PROMPTPAY" && !qrUrl && !isSandbox) return "รับ QR Code";
    if (method === "MOBILE_BANKING") return "เปิดแอปธนาคาร";
    if (method === "TRUEMONEY") return "เปิด TrueMoney Wallet";
    if (method === "SHOPEEPAY") return "เปิด ShopeePay";
    return `ยืนยันชำระ ฿${order.price.toFixed(0)}`;
  };

  return (
    <div className="min-h-screen bg-[#080a10] flex items-start justify-center px-4 py-10">
      <div className="w-full max-w-lg space-y-4">
        <Link href="/topup" className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-white transition-colors">
          <ArrowLeft className="w-4 h-4" /> กลับ
        </Link>

        {isSandbox && (
          <div className="flex items-center gap-2 px-4 py-2.5 bg-yellow-500/10 border border-yellow-500/30 rounded-xl text-yellow-400 text-xs">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>
              <strong>Sandbox mode</strong> — ไม่มีการเรียกเก็บเงินจริง
              {method === "CARD" && " · ใช้ 4242 4242 4242 4242 / 12/28 / 123"}
            </span>
          </div>
        )}

        {/* Order summary */}
        <div className="bg-[#141720] rounded-2xl border border-white/5 p-5">
          <p className="text-xs text-gray-500 uppercase tracking-widest mb-3">สรุปรายการ</p>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-300">{order.packageName}</span>
            <span className="text-sm text-white font-medium">{order.coins.toLocaleString()} เหรียญ</span>
          </div>
          {order.bonus > 0 && (
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-green-400">โบนัส</span>
              <span className="text-sm text-green-400">+{order.bonus.toLocaleString()} เหรียญ</span>
            </div>
          )}
          <div className="border-t border-white/5 mt-3 pt-3 flex items-center justify-between">
            <span className="text-sm text-gray-400 flex items-center gap-1.5">
              <Coins className="w-4 h-4 text-yellow-400" /> รวมได้รับ
            </span>
            <span className="font-bebas text-2xl text-yellow-400 tracking-wider">{total.toLocaleString()} เหรียญ</span>
          </div>
          <div className="flex items-center justify-between mt-1">
            <span className="text-xs text-gray-600">ยอดที่ต้องชำระ</span>
            <span className="text-xl font-bold text-white">฿{order.price.toFixed(0)}</span>
          </div>
        </div>

        {/* Payment tabs */}
        <div className="bg-[#141720] rounded-2xl border border-white/5 overflow-hidden">
          {/* Scrollable tab bar */}
          <div className="flex overflow-x-auto border-b border-white/5 scrollbar-none">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => { setMethod(tab.id); setError(""); setQrUrl(null); setSelectedBank(""); }}
                className={clsx(
                  "flex items-center gap-1.5 whitespace-nowrap px-4 py-3.5 text-xs font-medium transition-colors shrink-0",
                  method === tab.id ? "bg-white/5 text-white border-b-2 border-[#ff2d55]" : "text-gray-500 hover:text-gray-300"
                )}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>

          <div className="p-5">
            {/* CARD */}
            {method === "CARD" && (
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-gray-500 mb-1.5 block">หมายเลขบัตร</label>
                  <div className="relative">
                    <input
                      type="text" inputMode="numeric" placeholder="0000 0000 0000 0000"
                      value={cardNum} onChange={(e) => setCardNum(formatCard(e.target.value))}
                      maxLength={19}
                      className="w-full bg-[#1a1e2a] border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#ff2d55]/50 font-mono tracking-widest"
                    />
                    <CreditCard className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-gray-500 mb-1.5 block">วันหมดอายุ</label>
                    <input
                      type="text" inputMode="numeric" placeholder="MM/YY"
                      value={expiry} onChange={(e) => setExpiry(formatExpiry(e.target.value))}
                      maxLength={5}
                      className="w-full bg-[#1a1e2a] border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#ff2d55]/50 font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1.5 block">CVV</label>
                    <input
                      type="password" inputMode="numeric" placeholder="•••"
                      value={cvv} onChange={(e) => setCvv(e.target.value.replace(/\D/g, "").slice(0, 4))}
                      maxLength={4}
                      className="w-full bg-[#1a1e2a] border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#ff2d55]/50 font-mono"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1.5 block">ชื่อบนบัตร</label>
                  <input
                    type="text" placeholder="FIRSTNAME LASTNAME"
                    value={name} onChange={(e) => setName(e.target.value.toUpperCase())}
                    className="w-full bg-[#1a1e2a] border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#ff2d55]/50 uppercase tracking-wider"
                  />
                </div>
              </div>
            )}

            {/* PROMPTPAY */}
            {method === "PROMPTPAY" && (
              <div className="flex flex-col items-center gap-4 py-2">
                {qrLoading ? (
                  <div className="flex flex-col items-center gap-3 py-8">
                    <Loader2 className="w-8 h-8 text-[#ff2d55] animate-spin" />
                    <p className="text-sm text-gray-400">กำลังสร้าง QR Code...</p>
                  </div>
                ) : qrUrl ? (
                  <>
                    <p className="text-sm text-gray-400 text-center">สแกน QR Code ด้วยแอปธนาคารของคุณ</p>
                    <div className="bg-white p-3 rounded-2xl">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={qrUrl} alt="PromptPay QR" width={200} height={200} />
                    </div>
                    <p className="text-2xl font-bold text-white">฿{order.price.toFixed(0)}</p>
                    {polling && (
                      <div className="flex items-center gap-2 text-xs text-gray-400">
                        <RefreshCw className="w-3 h-3 animate-spin" />
                        กำลังรอการยืนยันการชำระเงิน...
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <Smartphone className="w-12 h-12 text-[#ff2d55]" />
                    <p className="text-sm text-gray-400 text-center">
                      {isSandbox
                        ? "Sandbox mode — กดยืนยันเพื่อจำลองการชำระผ่าน PromptPay"
                        : "กดปุ่มด้านล่างเพื่อรับ QR Code สำหรับชำระผ่าน PromptPay"}
                    </p>
                    <p className="text-2xl font-bold text-white">฿{order.price.toFixed(0)}</p>
                  </>
                )}
              </div>
            )}

            {/* MOBILE BANKING */}
            {method === "MOBILE_BANKING" && (
              <div className="space-y-4">
                <p className="text-xs text-gray-500">เลือกธนาคาร</p>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {BANKS.map((bank) => (
                    <button
                      key={bank.id}
                      onClick={() => setSelectedBank(bank.id)}
                      style={{ backgroundColor: selectedBank === bank.id ? bank.bg : undefined }}
                      className={clsx(
                        "flex flex-col items-center gap-1.5 p-3 rounded-xl border transition-all",
                        selectedBank === bank.id
                          ? "border-[#ff2d55]/60 ring-1 ring-[#ff2d55]/40"
                          : "bg-[#1a1e2a] border-white/10 hover:border-white/20"
                      )}
                    >
                      <div
                        className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold"
                        style={{ backgroundColor: bank.bg, color: bank.color, border: `1px solid ${bank.color}40` }}
                      >
                        {bank.label}
                      </div>
                      <span className="text-xs text-white font-medium">{bank.sub}</span>
                    </button>
                  ))}
                </div>
                {selectedBank && (
                  <p className="text-xs text-gray-500 text-center">
                    ระบบจะเปิดแอป{BANKS.find(b => b.id === selectedBank)?.sub} เพื่อยืนยันการชำระเงิน
                  </p>
                )}
              </div>
            )}

            {/* TRUEMONEY */}
            {method === "TRUEMONEY" && (
              <div className="flex flex-col items-center gap-4 py-3">
                <div className="w-16 h-16 rounded-2xl bg-[#ff6600]/10 border border-[#ff6600]/30 flex items-center justify-center">
                  <Wallet className="w-8 h-8 text-[#ff6600]" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-medium text-white mb-1">TrueMoney Wallet</p>
                  <p className="text-xs text-gray-400">ระบบจะเปิดแอป TrueMoney Wallet เพื่อยืนยันการชำระเงิน</p>
                </div>
                <p className="text-2xl font-bold text-white">฿{order.price.toFixed(0)}</p>
              </div>
            )}

            {/* SHOPEEPAY */}
            {method === "SHOPEEPAY" && (
              <div className="flex flex-col items-center gap-4 py-3">
                <div className="w-16 h-16 rounded-2xl bg-[#ee4d2d]/10 border border-[#ee4d2d]/30 flex items-center justify-center">
                  <Wallet className="w-8 h-8 text-[#ee4d2d]" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-medium text-white mb-1">ShopeePay</p>
                  <p className="text-xs text-gray-400">ระบบจะเปิดแอป Shopee เพื่อยืนยันการชำระเงิน</p>
                </div>
                <p className="text-2xl font-bold text-white">฿{order.price.toFixed(0)}</p>
              </div>
            )}

            {error && (
              <div className="mt-3 flex items-center gap-2 px-3 py-2.5 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
                <AlertCircle className="w-4 h-4 shrink-0" />
                {error}
              </div>
            )}

            {!isQrShowing && (
              <button
                onClick={handlePay}
                disabled={loading || qrLoading}
                className="mt-4 w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-gradient-to-r from-[#ff2d55] to-[#ff6b2b] text-white font-semibold text-sm hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {loading || qrLoading
                  ? <Loader2 className="w-4 h-4 animate-spin" />
                  : <Lock className="w-4 h-4" />}
                {buttonLabel()}
              </button>
            )}
          </div>
        </div>

        <div className="flex items-center justify-center gap-2 text-xs text-gray-600">
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>{omisePublicKey ? "ชำระเงินปลอดภัยด้วย Omise · SSL 256-bit" : "ข้อมูลของคุณถูกเข้ารหัสด้วย SSL 256-bit"}</span>
        </div>
        <p className="text-center text-xs text-gray-600">
          เหรียญปัจจุบัน: <span className="text-yellow-400">{userCoins.toLocaleString()}</span> เหรียญ
        </p>
      </div>
    </div>
  );
}
