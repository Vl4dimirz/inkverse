"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Wallet, AlertCircle, Loader2,
  CreditCard, Smartphone, Zap, Clock, Info,
} from "lucide-react";
import clsx from "clsx";
import { BANK_OPTIONS } from "@/lib/omise-payout";

const PLATFORM_CUT = 0.20;
const NET_RATE = 0.80;
const MIN_GROSS = 125; // net ≥ ฿100 → gross ≥ ฿125

const STATUS_STYLE: Record<string, { label: string; cls: string }> = {
  PENDING:    { label: "รอดำเนินการ",  cls: "bg-yellow-500/20 text-yellow-400" },
  PROCESSING: { label: "กำลังโอน",     cls: "bg-blue-500/20 text-blue-400" },
  PAID:       { label: "โอนแล้ว",      cls: "bg-green-500/20 text-green-400" },
  FAILED:     { label: "ไม่สำเร็จ",    cls: "bg-red-500/20 text-red-400" },
  REJECTED:   { label: "ถูกปฏิเสธ",    cls: "bg-red-500/20 text-red-400" },
  APPROVED:   { label: "อนุมัติแล้ว",  cls: "bg-blue-500/20 text-blue-400" },
};

interface WithdrawClientProps {
  availableBalance: number;
  history: {
    id: string; amount: number; status: string;
    paymentMethod: string; accountNumber: string; bankName: string | null;
    bankCode: string | null; requestedAt: string; processedAt: string | null;
    adminNote: string | null;
  }[];
}

export default function WithdrawClient({ availableBalance, history }: WithdrawClientProps) {
  const router = useRouter();
  const [method, setMethod] = useState<"BANK_TRANSFER" | "PROMPTPAY">("BANK_TRANSFER");
  const [amount, setAmount] = useState("");
  const [accountName, setAccountName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [bankCode, setBankCode] = useState<string>(BANK_OPTIONS[0].code);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState<{
    auto: boolean; netAmount: number; platformFee: number;
  } | null>(null);

  const amountNum = parseFloat(amount) || 0;
  const netAmount = Math.round(amountNum * NET_RATE * 100) / 100;
  const platformFee = Math.round(amountNum * PLATFORM_CUT * 100) / 100;

  const canSubmit =
    amountNum >= MIN_GROSS && amountNum <= availableBalance + 0.001 &&
    accountName.trim() && accountNumber.trim();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!canSubmit) return;
    setLoading(true);
    try {
      const bank = BANK_OPTIONS.find((b) => b.code === bankCode);
      const res = await fetch("/api/translator/withdraw", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: amountNum,
          paymentMethod: method,
          accountName: accountName.trim(),
          accountNumber: accountNumber.trim(),
          bankCode: method === "BANK_TRANSFER" ? bankCode : undefined,
          bankName: method === "BANK_TRANSFER" ? (bank?.name ?? undefined) : undefined,
        }),
      });
      const data = await res.json() as {
        ok?: boolean; error?: string; auto?: boolean; netAmount?: number; platformFee?: number;
      };
      if (!res.ok) { setError(data.error ?? "เกิดข้อผิดพลาด"); return; }
      setSubmitted({
        auto: data.auto ?? false,
        netAmount: data.netAmount ?? netAmount,
        platformFee: data.platformFee ?? platformFee,
      });
      router.refresh();
    } catch {
      setError("เกิดข้อผิดพลาด กรุณาลองใหม่");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-xl mx-auto space-y-6">
      {/* Balance */}
      <div className="bg-[#141720] rounded-2xl border border-white/5 p-5">
        <p className="text-xs text-gray-500 uppercase tracking-widest mb-1">ยอดที่ถอนได้</p>
        <p className="font-bebas text-5xl text-white tracking-wider">฿{availableBalance.toFixed(2)}</p>
        <p className="text-xs text-gray-600 mt-1">ถอนขั้นต่ำ ฿{MIN_GROSS} · หักค่าแพลตฟอร์ม 20% → รับจริง ฿{(MIN_GROSS * NET_RATE).toFixed(0)}</p>
      </div>

      {/* Fee info banner */}
      <div className="flex items-start gap-2.5 px-4 py-3 bg-white/3 border border-white/8 rounded-xl text-xs text-gray-400">
        <Info className="w-3.5 h-3.5 mt-0.5 shrink-0 text-gray-500" />
        <span>
          แพลตฟอร์มหัก <span className="text-white font-medium">20%</span> จากยอดที่ขอถอน
          &nbsp;·&nbsp; ยอดที่โอนให้จริง = ยอดที่ขอ × 80%
        </span>
      </div>

      {submitted ? (
        <div className={clsx(
          "bg-[#141720] rounded-2xl border p-6 text-center space-y-4",
          submitted.auto ? "border-green-500/20" : "border-yellow-500/20"
        )}>
          {submitted.auto ? (
            <Zap className="w-10 h-10 text-green-400 mx-auto" />
          ) : (
            <Clock className="w-10 h-10 text-yellow-400 mx-auto" />
          )}

          <div>
            <p className="text-white font-semibold">
              {submitted.auto ? "ส่งคำสั่งโอนสำเร็จ!" : "รับคำขอถอนเงินแล้ว"}
            </p>
            <p className="text-sm text-gray-400 mt-1">
              {submitted.auto
                ? "ระบบส่งคำสั่งโอนผ่าน Omise แล้ว เงินจะเข้าภายใน 1–3 วันทำการ"
                : "ทีมงานจะดำเนินการโอนภายใน 1–2 วันทำการ"}
            </p>
          </div>

          {/* Breakdown summary */}
          <div className="bg-black/20 rounded-xl px-4 py-3 text-sm space-y-1.5 text-left">
            <div className="flex justify-between text-gray-400">
              <span>ยอดที่ขอถอน</span>
              <span className="text-white">฿{(submitted.netAmount / NET_RATE).toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-gray-500 text-xs">
              <span>ค่าแพลตฟอร์ม 20%</span>
              <span className="text-red-400">−฿{submitted.platformFee.toFixed(2)}</span>
            </div>
            <div className="h-px bg-white/10" />
            <div className="flex justify-between font-semibold">
              <span className="text-gray-300">ยอดที่จะได้รับ</span>
              <span className="text-green-400">฿{submitted.netAmount.toFixed(2)}</span>
            </div>
          </div>

          <button
            onClick={() => { setSubmitted(null); setAmount(""); }}
            className="text-xs text-[#ff6b2b] hover:underline"
          >
            ส่งคำขออีกครั้ง
          </button>
        </div>
      ) : availableBalance < MIN_GROSS ? (
        <div className="bg-[#141720] rounded-2xl border border-white/5 p-6 text-center space-y-2">
          <Wallet className="w-10 h-10 text-gray-600 mx-auto" />
          <p className="text-sm text-gray-400">
            ยอดเงินต่ำกว่าขั้นต่ำ (฿{MIN_GROSS}) ยังไม่สามารถถอนได้
          </p>
          <p className="text-xs text-gray-600">ยอดปัจจุบัน: ฿{availableBalance.toFixed(2)}</p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="bg-[#141720] rounded-2xl border border-white/5 p-5 space-y-4">
          <h2 className="text-sm font-semibold text-white">ขอถอนเงิน</h2>

          {/* Amount + breakdown */}
          <div>
            <label className="text-xs text-gray-500 mb-1.5 block">จำนวนเงินที่ต้องการถอน (บาท)</label>
            <div className="flex gap-2">
              <input
                type="number" min={MIN_GROSS} max={availableBalance} step={1}
                value={amount} onChange={(e) => setAmount(e.target.value)}
                placeholder={`ขั้นต่ำ ฿${MIN_GROSS}`}
                className="flex-1 bg-[#1a1e2a] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#ff2d55]/50"
              />
              <button
                type="button" onClick={() => setAmount(String(availableBalance))}
                className="px-3 py-2.5 text-xs text-[#ff6b2b] bg-white/5 rounded-xl hover:bg-white/10 transition-colors"
              >
                ทั้งหมด
              </button>
            </div>

            {/* Live fee breakdown */}
            {amountNum > 0 && (
              <div className="mt-2 px-3 py-2.5 bg-black/20 rounded-xl text-xs space-y-1.5">
                <div className="flex justify-between text-gray-500">
                  <span>ยอดที่ขอถอน</span>
                  <span className="text-gray-300">฿{amountNum.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-gray-500">
                  <span>ค่าแพลตฟอร์ม 20%</span>
                  <span className="text-red-400">−฿{platformFee.toFixed(2)}</span>
                </div>
                <div className="h-px bg-white/8" />
                <div className="flex justify-between font-semibold">
                  <span className="text-gray-300">ยอดที่จะได้รับ</span>
                  <span className={amountNum >= MIN_GROSS ? "text-green-400" : "text-red-400"}>
                    ฿{netAmount.toFixed(2)}
                  </span>
                </div>
              </div>
            )}

            {amountNum > 0 && amountNum < MIN_GROSS && (
              <p className="text-xs text-red-400 mt-1.5">
                ต้องถอนอย่างน้อย ฿{MIN_GROSS} เพื่อรับเงิน ฿{(MIN_GROSS * NET_RATE).toFixed(0)} หลังหัก 20%
              </p>
            )}
          </div>

          {/* Payment method */}
          <div>
            <label className="text-xs text-gray-500 mb-1.5 block">ช่องทางรับเงิน</label>
            <div className="grid grid-cols-2 gap-2">
              {([
                { id: "BANK_TRANSFER", label: "โอนธนาคาร", icon: CreditCard, badge: "อัตโนมัติ" },
                { id: "PROMPTPAY",     label: "PromptPay",  icon: Smartphone, badge: "1–2 วัน" },
              ] as const).map((m) => (
                <button
                  key={m.id} type="button" onClick={() => setMethod(m.id)}
                  className={clsx(
                    "flex flex-col items-start gap-1 px-3 py-3 rounded-xl border text-sm transition-all",
                    method === m.id
                      ? "bg-[#ff2d55]/10 border-[#ff2d55]/50 text-white"
                      : "bg-[#1a1e2a] border-white/10 text-gray-400 hover:border-white/20"
                  )}
                >
                  <div className="flex items-center gap-2">
                    <m.icon className="w-4 h-4" />
                    {m.label}
                  </div>
                  <span className={clsx(
                    "text-xs px-1.5 py-0.5 rounded-full",
                    m.id === "BANK_TRANSFER"
                      ? "bg-green-500/20 text-green-400"
                      : "bg-yellow-500/20 text-yellow-400"
                  )}>
                    {m.badge}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Bank selector */}
          {method === "BANK_TRANSFER" && (
            <div>
              <label className="text-xs text-gray-500 mb-1.5 block">ธนาคาร</label>
              <select
                value={bankCode} onChange={(e) => setBankCode(e.target.value)}
                className="w-full bg-[#1a1e2a] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#ff2d55]/50"
              >
                {BANK_OPTIONS.map((b) => (
                  <option key={b.code} value={b.code}>{b.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Account number */}
          <div>
            <label className="text-xs text-gray-500 mb-1.5 block">
              {method === "PROMPTPAY" ? "เบอร์มือถือ / เลขบัตรประชาชน" : "เลขบัญชี"}
            </label>
            <input
              type="text" value={accountNumber}
              onChange={(e) => setAccountNumber(e.target.value)}
              placeholder={method === "PROMPTPAY" ? "0XX-XXX-XXXX" : "XXX-X-XXXXX-X"}
              className="w-full bg-[#1a1e2a] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#ff2d55]/50 font-mono"
            />
          </div>

          {/* Account name */}
          <div>
            <label className="text-xs text-gray-500 mb-1.5 block">ชื่อเจ้าของบัญชี</label>
            <input
              type="text" value={accountName}
              onChange={(e) => setAccountName(e.target.value)}
              placeholder="ชื่อ-นามสกุล (ภาษาไทยหรืออังกฤษ)"
              className="w-full bg-[#1a1e2a] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#ff2d55]/50"
            />
          </div>

          {method === "BANK_TRANSFER" && (
            <div className="flex items-start gap-2 px-3 py-2.5 bg-green-500/5 border border-green-500/20 rounded-xl text-xs text-green-400/90">
              <Zap className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              ระบบจะโอนเงินอัตโนมัติผ่าน Omise ภายใน 1–3 วันทำการ ไม่ต้องรอ admin อนุมัติ
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 px-3 py-2.5 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}

          <button
            type="submit" disabled={loading || !canSubmit}
            className="w-full flex flex-col items-center gap-0.5 py-3 rounded-xl bg-gradient-to-r from-[#ff2d55] to-[#ff6b2b] text-white font-semibold text-sm hover:opacity-90 transition-opacity disabled:opacity-40"
          >
            <div className="flex items-center gap-2">
              {loading
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : method === "BANK_TRANSFER" ? <Zap className="w-4 h-4" /> : <Wallet className="w-4 h-4" />}
              {loading
                ? "กำลังดำเนินการ..."
                : method === "BANK_TRANSFER"
                ? "โอนอัตโนมัติ"
                : "ขอถอนเงิน"}
            </div>
            {!loading && amountNum >= MIN_GROSS && (
              <span className="text-xs font-normal opacity-80">
                ได้รับจริง ฿{netAmount.toFixed(2)} (หลังหัก ฿{platformFee.toFixed(2)})
              </span>
            )}
          </button>
        </form>
      )}

      {/* History */}
      {history.length > 0 && (
        <div className="bg-[#141720] rounded-2xl border border-white/5 p-5">
          <h2 className="text-sm font-semibold text-white mb-4">ประวัติคำขอถอนเงิน</h2>
          <div className="divide-y divide-white/5">
            {history.map((w) => {
              const s = STATUS_STYLE[w.status] ?? STATUS_STYLE.PENDING;
              const net = Math.round(w.amount * NET_RATE * 100) / 100;
              const fee = Math.round(w.amount * PLATFORM_CUT * 100) / 100;
              return (
                <div key={w.id} className="py-3 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-sm font-medium text-white">
                        ขอถอน ฿{w.amount.toFixed(2)}
                      </span>
                      <span className="text-xs text-gray-600 ml-1.5">
                        → รับจริง <span className="text-green-400">฿{net.toFixed(2)}</span>
                        <span className="text-gray-700 ml-1">(หัก ฿{fee.toFixed(2)})</span>
                      </span>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${s.cls}`}>{s.label}</span>
                  </div>
                  <p className="text-xs text-gray-500">
                    {w.paymentMethod === "PROMPTPAY"
                      ? `PromptPay · ${w.accountNumber}`
                      : `${w.bankName ?? "ธนาคาร"} · ${w.accountNumber}`}
                  </p>
                  <p className="text-xs text-gray-600">
                    {new Date(w.requestedAt).toLocaleDateString("th-TH", {
                      day: "numeric", month: "short", year: "numeric",
                    })}
                    {w.processedAt && ` · โอนแล้ว ${new Date(w.processedAt).toLocaleDateString("th-TH", { day: "numeric", month: "short" })}`}
                  </p>
                  {w.adminNote && (
                    <p className="text-xs text-yellow-400/80 bg-yellow-500/5 px-2 py-1 rounded-lg">
                      {w.adminNote}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
