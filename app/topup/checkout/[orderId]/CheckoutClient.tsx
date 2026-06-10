"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Coins, CreditCard, Smartphone, ShieldCheck, ArrowLeft,
  AlertCircle, Lock, Loader2, Wallet, Upload, CheckCircle2,
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
  omiseLive,
  promptpayQrImage,
  promptpayName,
}: {
  order: Order;
  userCoins: number;
  isSandbox: boolean;
  omisePublicKey?: string;
  omiseLive?: boolean;
  promptpayQrImage?: string;
  promptpayName?: string;
}) {
  const router = useRouter();
  const total = order.coins + order.bonus;

  // Only show a channel that can actually take real money:
  //  • PromptPay → needs a configured QR image
  //  • Card / Mobile Banking / TrueMoney / ShopeePay → need Omise LIVE keys
  const availableTabs = TABS.filter((t) =>
    t.id === "PROMPTPAY" ? !!promptpayQrImage : !!omiseLive
  );

  const [method, setMethod] = useState<Method>(availableTabs[0]?.id ?? "PROMPTPAY");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Card fields
  const [cardNum, setCardNum] = useState("");
  const [expiry, setExpiry] = useState("");
  const [cvv, setCvv] = useState("");
  const [name, setName] = useState("");

  // PromptPay slip
  const [slipFile, setSlipFile] = useState<File | null>(null);
  const [slipPreview, setSlipPreview] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);

  // Mobile banking bank selection
  const [selectedBank, setSelectedBank] = useState<string>("");

  const [omiseReady, setOmiseReady] = useState(false);

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
    return () => { if (slipPreview) URL.revokeObjectURL(slipPreview); };
  }, [slipPreview]);

  function onSlipChange(file: File | null) {
    setError("");
    if (slipPreview) URL.revokeObjectURL(slipPreview);
    setSlipFile(file);
    setSlipPreview(file ? URL.createObjectURL(file) : null);
  }

  async function verifySlip() {
    if (!slipFile) { setError("กรุณาแนบรูปสลิปการโอนเงิน"); return; }
    setVerifying(true);
    setError("");
    try {
      const fd = new FormData();
      fd.append("file", slipFile);
      const res = await fetch(`/api/coin/order/${order.id}/verify-slip`, {
        method: "POST",
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "ตรวจสอบสลิปไม่สำเร็จ"); return; }
      router.push(`/topup/success/${order.id}`);
    } catch {
      setError("เกิดข้อผิดพลาด กรุณาลองใหม่");
    } finally {
      setVerifying(false);
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

  const buttonLabel = () => {
    if (method === "MOBILE_BANKING") return "เปิดแอปธนาคาร";
    if (method === "TRUEMONEY") return "เปิด TrueMoney Wallet";
    if (method === "SHOPEEPAY") return "เปิด ShopeePay";
    return `ยืนยันชำระ ฿${order.price.toFixed(0)}`;
  };

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] flex items-start justify-center px-4 py-10">
      <div className="w-full max-w-lg space-y-4">
        <Link href="/topup" className="inline-flex items-center gap-2 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors">
          <ArrowLeft className="w-4 h-4" /> กลับ
        </Link>

        {isSandbox && method !== "PROMPTPAY" && (
          <div className="flex items-center gap-2 px-4 py-2.5 bg-yellow-500/10 border border-yellow-500/30 rounded-xl text-yellow-400 text-xs">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>
              <strong>Sandbox mode</strong> — ไม่มีการเรียกเก็บเงินจริง
              {method === "CARD" && " · ใช้ 4242 4242 4242 4242 / 12/28 / 123"}
            </span>
          </div>
        )}

        {/* Order summary */}
        <div className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border)] p-5">
          <p className="text-xs text-[var(--text-secondary)] uppercase tracking-widest mb-3">สรุปรายการ</p>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-[var(--text-primary)]">{order.packageName}</span>
            <span className="text-sm text-[var(--text-primary)] font-medium">{order.coins.toLocaleString()} เหรียญ</span>
          </div>
          {order.bonus > 0 && (
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-green-400">โบนัส</span>
              <span className="text-sm text-green-400">+{order.bonus.toLocaleString()} เหรียญ</span>
            </div>
          )}
          <div className="border-t border-[var(--border)] mt-3 pt-3 flex items-center justify-between">
            <span className="text-sm text-[var(--text-secondary)] flex items-center gap-1.5">
              <Coins className="w-4 h-4 text-yellow-400" /> รวมได้รับ
            </span>
            <span className="font-bebas text-2xl text-yellow-400 tracking-wider">{total.toLocaleString()} เหรียญ</span>
          </div>
          <div className="flex items-center justify-between mt-1">
            <span className="text-xs text-[var(--text-muted)]">ยอดที่ต้องชำระ</span>
            <span className="text-xl font-bold text-[var(--text-primary)]">฿{order.price.toFixed(0)}</span>
          </div>
        </div>

        {/* Payment tabs */}
        <div className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border)] overflow-hidden">
          {/* Scrollable tab bar — hidden when only one channel is available */}
          <div className={clsx("flex overflow-x-auto border-b border-[var(--border)] scrollbar-none", availableTabs.length <= 1 && "hidden")}>
            {availableTabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => { setMethod(tab.id); setError(""); setSelectedBank(""); }}
                className={clsx(
                  "flex items-center gap-1.5 whitespace-nowrap px-4 py-3.5 text-xs font-medium transition-colors shrink-0",
                  method === tab.id ? "bg-white/5 text-[var(--text-primary)] border-b-2 border-[var(--text-primary)]" : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
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
                  <label className="text-xs text-[var(--text-secondary)] mb-1.5 block">หมายเลขบัตร</label>
                  <div className="relative">
                    <input
                      type="text" inputMode="numeric" placeholder="0000 0000 0000 0000"
                      value={cardNum} onChange={(e) => setCardNum(formatCard(e.target.value))}
                      maxLength={19}
                      className="w-full bg-[var(--bg-card)] border border-[var(--border)] rounded-xl px-4 py-3 text-sm text-[var(--text-primary)] placeholder-gray-600 focus:outline-none focus:border-[var(--text-primary)]/50 font-mono tracking-widest"
                    />
                    <CreditCard className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-[var(--text-secondary)] mb-1.5 block">วันหมดอายุ</label>
                    <input
                      type="text" inputMode="numeric" placeholder="MM/YY"
                      value={expiry} onChange={(e) => setExpiry(formatExpiry(e.target.value))}
                      maxLength={5}
                      className="w-full bg-[var(--bg-card)] border border-[var(--border)] rounded-xl px-4 py-3 text-sm text-[var(--text-primary)] placeholder-gray-600 focus:outline-none focus:border-[var(--text-primary)]/50 font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-[var(--text-secondary)] mb-1.5 block">CVV</label>
                    <input
                      type="password" inputMode="numeric" placeholder="•••"
                      value={cvv} onChange={(e) => setCvv(e.target.value.replace(/\D/g, "").slice(0, 4))}
                      maxLength={4}
                      className="w-full bg-[var(--bg-card)] border border-[var(--border)] rounded-xl px-4 py-3 text-sm text-[var(--text-primary)] placeholder-gray-600 focus:outline-none focus:border-[var(--text-primary)]/50 font-mono"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs text-[var(--text-secondary)] mb-1.5 block">ชื่อบนบัตร</label>
                  <input
                    type="text" placeholder="FIRSTNAME LASTNAME"
                    value={name} onChange={(e) => setName(e.target.value.toUpperCase())}
                    className="w-full bg-[var(--bg-card)] border border-[var(--border)] rounded-xl px-4 py-3 text-sm text-[var(--text-primary)] placeholder-gray-600 focus:outline-none focus:border-[var(--text-primary)]/50 uppercase tracking-wider"
                  />
                </div>
              </div>
            )}

            {/* PROMPTPAY */}
            {method === "PROMPTPAY" && (
              <div className="flex flex-col items-center gap-4 py-2">
                {!promptpayQrImage ? (
                  <div className="flex items-center gap-2 px-3 py-2.5 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    ยังไม่ได้ตั้งค่า QR PromptPay กรุณาเลือกช่องทางอื่น
                  </div>
                ) : (
                  <>
                    {/* Step 1 — scan & pay */}
                    <p className="text-sm text-[var(--text-secondary)] text-center">
                      <span className="text-[var(--text-primary)] font-medium">1.</span> สแกน QR ด้วยแอปธนาคาร แล้วโอนยอดให้ตรงตามจำนวน
                    </p>
                    <div className="bg-white p-3 rounded-2xl">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={promptpayQrImage} alt="PromptPay QR" width={220} height={220} />
                    </div>
                    {promptpayName && (
                      <p className="text-xs text-[var(--text-secondary)] text-center -mt-1">{promptpayName}</p>
                    )}
                    <div className="text-center">
                      <p className="text-xs text-[var(--text-muted)]">ยอดที่ต้องโอน</p>
                      <p className="text-2xl font-bold text-[var(--text-primary)]">฿{order.price.toFixed(0)}</p>
                    </div>

                    {/* Step 2 — upload slip */}
                    <div className="w-full border-t border-[var(--border)] pt-4">
                      <p className="text-sm text-[var(--text-secondary)] text-center mb-3">
                        <span className="text-[var(--text-primary)] font-medium">2.</span> อัปโหลดสลิปการโอนเพื่อยืนยันอัตโนมัติ
                      </p>
                      <label
                        className={clsx(
                          "flex flex-col items-center justify-center gap-2 w-full rounded-xl border border-dashed cursor-pointer transition-colors",
                          slipPreview
                            ? "border-[var(--text-primary)]/40 bg-[var(--bg-card)] p-3"
                            : "border-white/15 bg-[var(--bg-card)] hover:border-white/30 py-8 px-4"
                        )}
                      >
                        {slipPreview ? (
                          <>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={slipPreview} alt="สลิป" className="max-h-44 rounded-lg" />
                            <span className="flex items-center gap-1.5 text-xs text-green-400">
                              <CheckCircle2 className="w-3.5 h-3.5" /> แนบสลิปแล้ว · แตะเพื่อเปลี่ยน
                            </span>
                          </>
                        ) : (
                          <>
                            <Upload className="w-7 h-7 text-[var(--text-secondary)]" />
                            <span className="text-xs text-[var(--text-secondary)]">แตะเพื่อเลือกรูปสลิป (สูงสุด 4MB)</span>
                          </>
                        )}
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => onSlipChange(e.target.files?.[0] ?? null)}
                        />
                      </label>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* MOBILE BANKING */}
            {method === "MOBILE_BANKING" && (
              <div className="space-y-4">
                <p className="text-xs text-[var(--text-secondary)]">เลือกธนาคาร</p>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {BANKS.map((bank) => (
                    <button
                      key={bank.id}
                      onClick={() => setSelectedBank(bank.id)}
                      style={{ backgroundColor: selectedBank === bank.id ? bank.bg : undefined }}
                      className={clsx(
                        "flex flex-col items-center gap-1.5 p-3 rounded-xl border transition-all",
                        selectedBank === bank.id
                          ? "border-[var(--text-primary)]/60 ring-1 ring-[var(--text-primary)]/40"
                          : "bg-[var(--bg-card)] border-[var(--border)] hover:border-white/20"
                      )}
                    >
                      <div
                        className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold"
                        style={{ backgroundColor: bank.bg, color: bank.color, border: `1px solid ${bank.color}40` }}
                      >
                        {bank.label}
                      </div>
                      <span className="text-xs text-[var(--text-primary)] font-medium">{bank.sub}</span>
                    </button>
                  ))}
                </div>
                {selectedBank && (
                  <p className="text-xs text-[var(--text-secondary)] text-center">
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
                  <p className="text-sm font-medium text-[var(--text-primary)] mb-1">TrueMoney Wallet</p>
                  <p className="text-xs text-[var(--text-secondary)]">ระบบจะเปิดแอป TrueMoney Wallet เพื่อยืนยันการชำระเงิน</p>
                </div>
                <p className="text-2xl font-bold text-[var(--text-primary)]">฿{order.price.toFixed(0)}</p>
              </div>
            )}

            {/* SHOPEEPAY */}
            {method === "SHOPEEPAY" && (
              <div className="flex flex-col items-center gap-4 py-3">
                <div className="w-16 h-16 rounded-2xl bg-[#ee4d2d]/10 border border-[#ee4d2d]/30 flex items-center justify-center">
                  <Wallet className="w-8 h-8 text-[#ee4d2d]" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-medium text-[var(--text-primary)] mb-1">ShopeePay</p>
                  <p className="text-xs text-[var(--text-secondary)]">ระบบจะเปิดแอป Shopee เพื่อยืนยันการชำระเงิน</p>
                </div>
                <p className="text-2xl font-bold text-[var(--text-primary)]">฿{order.price.toFixed(0)}</p>
              </div>
            )}

            {error && (
              <div className="mt-3 flex items-center gap-2 px-3 py-2.5 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
                <AlertCircle className="w-4 h-4 shrink-0" />
                {error}
              </div>
            )}

            {method === "PROMPTPAY" ? (
              promptpayQrImage && (
                <button
                  onClick={verifySlip}
                  disabled={verifying || !slipFile}
                  className="mt-4 w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-[var(--text-primary)] text-[var(--bg-primary)] font-semibold text-sm hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  {verifying
                    ? <><Loader2 className="w-4 h-4 animate-spin" /> กำลังตรวจสอบสลิป...</>
                    : <><CheckCircle2 className="w-4 h-4" /> ยืนยันการชำระเงิน</>}
                </button>
              )
            ) : (
              <button
                onClick={handlePay}
                disabled={loading}
                className="mt-4 w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-[var(--text-primary)] text-[var(--bg-primary)] font-semibold text-sm hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {loading
                  ? <Loader2 className="w-4 h-4 animate-spin" />
                  : <Lock className="w-4 h-4" />}
                {buttonLabel()}
              </button>
            )}
          </div>
        </div>

        <div className="flex items-center justify-center gap-2 text-xs text-[var(--text-muted)]">
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>{omisePublicKey ? "ชำระเงินปลอดภัยด้วย Omise · SSL 256-bit" : "ข้อมูลของคุณถูกเข้ารหัสด้วย SSL 256-bit"}</span>
        </div>
        <p className="text-center text-xs text-[var(--text-muted)]">
          เหรียญปัจจุบัน: <span className="text-yellow-400">{userCoins.toLocaleString()}</span> เหรียญ
        </p>
      </div>
    </div>
  );
}
