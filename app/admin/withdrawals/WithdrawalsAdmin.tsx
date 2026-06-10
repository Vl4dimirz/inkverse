"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, XCircle, Clock, Loader2, ChevronDown, Zap, RefreshCw } from "lucide-react";
import clsx from "clsx";

const NET_RATE = 0.80;
const PLATFORM_CUT = 0.20;

interface Request {
  id: string;
  amount: number;
  status: string;
  paymentMethod: string;
  accountName: string;
  accountNumber: string;
  bankName: string | null;
  bankCode: string | null;
  adminNote: string | null;
  omiseTransferId: string | null;
  omiseRecipientId: string | null;
  requestedAt: string;
  processedAt: string | null;
  translator: { penName: string; email: string; avatarUrl: string | null };
}

const STATUS_STYLE: Record<string, { label: string; cls: string; icon: React.ElementType }> = {
  PENDING:    { label: "รอดำเนินการ", cls: "bg-yellow-500/20 text-yellow-400",  icon: Clock },
  PROCESSING: { label: "กำลังโอน",    cls: "bg-blue-500/20 text-blue-400",     icon: Zap },
  APPROVED:   { label: "อนุมัติแล้ว", cls: "bg-blue-500/20 text-blue-400",    icon: CheckCircle2 },
  PAID:       { label: "โอนแล้ว",     cls: "bg-green-500/20 text-green-400",  icon: CheckCircle2 },
  REJECTED:   { label: "ถูกปฏิเสธ",   cls: "bg-red-500/20 text-red-400",      icon: XCircle },
  FAILED:     { label: "ไม่สำเร็จ",   cls: "bg-red-500/20 text-red-400",      icon: XCircle },
};

function RequestCard({ req, onAction }: { req: Request; onAction: () => void }) {
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshResult, setRefreshResult] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [showNote, setShowNote] = useState(false);
  const router = useRouter();
  const s = STATUS_STYLE[req.status] ?? STATUS_STYLE.PENDING;
  const Icon = s.icon;

  async function action(type: "approve" | "paid" | "reject") {
    setLoading(true);
    try {
      await fetch(`/api/admin/withdrawals/${req.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: type, adminNote: note }),
      });
      router.refresh();
      onAction();
    } finally {
      setLoading(false);
    }
  }

  async function refreshOmise() {
    if (!req.omiseTransferId) return;
    setRefreshing(true);
    setRefreshResult(null);
    try {
      const res = await fetch(`/api/admin/withdrawals/${req.id}/refresh-transfer`);
      const data = await res.json() as { status?: string; paid?: boolean; sent?: boolean; error?: string };
      if (data.error) {
        setRefreshResult(`Error: ${data.error}`);
      } else {
        setRefreshResult(`Omise: ${data.status ?? "?"} | sent=${data.sent} | paid=${data.paid}`);
        router.refresh();
      }
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <div className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border)] p-5 space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="font-semibold text-[var(--text-primary)]">{req.translator.penName}</span>
            <span className="text-xs text-[var(--text-secondary)]">·</span>
            <span className="text-xs text-[var(--text-secondary)]">{req.translator.email}</span>
          </div>
          <div className="flex items-baseline gap-2 flex-wrap">
            <p className="font-bebas text-3xl text-[var(--text-primary)] tracking-wider">
              ฿{(req.amount * NET_RATE).toFixed(2)}
            </p>
            <span className="text-xs text-[var(--text-secondary)]">
              โอนจริง <span className="text-[var(--text-secondary)]">(ขอ ฿{req.amount.toFixed(2)} · หัก ฿{(req.amount * PLATFORM_CUT).toFixed(2)})</span>
            </span>
          </div>
          <div className="flex items-center gap-2 mt-1 text-xs text-[var(--text-secondary)] flex-wrap">
            <span>
              {req.paymentMethod === "PROMPTPAY"
                ? "PromptPay"
                : `${req.bankName ?? req.bankCode ?? "ธนาคาร"}`}
            </span>
            <span>·</span>
            <span className="font-mono">{req.accountNumber}</span>
            <span>·</span>
            <span>{req.accountName}</span>
          </div>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">
            ขอเมื่อ {new Date(req.requestedAt).toLocaleDateString("th-TH", {
              day: "numeric", month: "short", year: "numeric",
              hour: "2-digit", minute: "2-digit",
            })}
          </p>
          {/* Auto-payout badge */}
          {req.paymentMethod === "BANK_TRANSFER" && req.omiseTransferId && (
            <div className="flex flex-wrap items-center gap-2 mt-2">
              <span className="flex items-center gap-1 text-xs bg-green-500/10 text-green-400 px-2 py-0.5 rounded-full">
                <Zap className="w-3 h-3" /> Auto-payout
              </span>
              <span className="font-mono text-xs text-[var(--text-muted)] truncate max-w-[180px]" title={req.omiseTransferId}>
                {req.omiseTransferId}
              </span>
            </div>
          )}
        </div>
        <span className={clsx("flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full shrink-0", s.cls)}>
          <Icon className="w-3 h-3" />
          {s.label}
        </span>
      </div>

      {req.adminNote && (
        <p className="text-xs text-yellow-400/80 bg-yellow-500/5 px-3 py-2 rounded-xl">
          หมายเหตุ: {req.adminNote}
        </p>
      )}

      {/* PROCESSING: show refresh button */}
      {req.status === "PROCESSING" && req.omiseTransferId && (
        <div className="pt-2 border-t border-[var(--border)] space-y-2">
          <button
            onClick={refreshOmise}
            disabled={refreshing}
            className="flex items-center gap-2 px-3 py-2 rounded-xl bg-blue-500/10 text-blue-400 text-xs font-medium hover:bg-blue-500/20 transition-colors disabled:opacity-50"
          >
            {refreshing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
            ตรวจสอบสถานะจาก Omise
          </button>
          {refreshResult && (
            <p className="text-xs text-[var(--text-secondary)] font-mono bg-black/30 px-3 py-1.5 rounded-lg">{refreshResult}</p>
          )}
          <p className="text-xs text-[var(--text-muted)]">
            ระบบโอนอัตโนมัติผ่าน Omise — webhook จะอัปเดต status เป็น PAID เมื่อโอนสำเร็จ
          </p>
        </div>
      )}

      {/* PENDING (PromptPay or auto-payout failed): manual actions */}
      {req.status === "PENDING" && (
        <div className="space-y-3 pt-2 border-t border-[var(--border)]">
          {req.paymentMethod === "PROMPTPAY" && (
            <p className="text-xs text-yellow-400/80 bg-yellow-500/5 px-3 py-2 rounded-xl">
              PromptPay — ต้องโอนด้วยตนเอง แล้วกด "ยืนยันโอนแล้ว"
            </p>
          )}
          {req.paymentMethod === "BANK_TRANSFER" && !req.omiseTransferId && (
            <p className="text-xs text-orange-400/80 bg-orange-500/5 px-3 py-2 rounded-xl">
              Auto-payout ล้มเหลว — ต้องอนุมัติและโอนด้วยตนเอง
            </p>
          )}
          <button
            onClick={() => setShowNote(!showNote)}
            className="flex items-center gap-1 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
          >
            <ChevronDown className={clsx("w-3.5 h-3.5 transition-transform", showNote && "rotate-180")} />
            {showNote ? "ซ่อน" : "เพิ่ม"} หมายเหตุ (optional)
          </button>
          {showNote && (
            <input
              type="text" value={note} onChange={(e) => setNote(e.target.value)}
              placeholder="หมายเหตุถึงนักแปล..."
              className="w-full bg-[var(--bg-card)] border border-[var(--border)] rounded-xl px-3 py-2 text-sm text-[var(--text-primary)] placeholder-gray-600 focus:outline-none focus:border-[var(--text-primary)]/50"
            />
          )}
          <div className="flex gap-2">
            <button
              onClick={() => action("paid")}
              disabled={loading}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-green-500/20 text-green-400 text-sm font-medium hover:bg-green-500/30 transition-colors disabled:opacity-50"
            >
              {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
              ยืนยันโอนแล้ว
            </button>
            <button
              onClick={() => action("reject")}
              disabled={loading}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-red-500/20 text-red-400 text-sm font-medium hover:bg-red-500/30 transition-colors disabled:opacity-50"
            >
              {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <XCircle className="w-3.5 h-3.5" />}
              ปฏิเสธ
            </button>
          </div>
        </div>
      )}

      {req.status === "APPROVED" && (
        <div className="pt-2 border-t border-[var(--border)]">
          <button
            onClick={() => action("paid")}
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 py-2 rounded-xl bg-green-500/20 text-green-400 text-sm font-medium hover:bg-green-500/30 transition-colors disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
            ยืนยันว่าโอนเงินแล้ว
          </button>
        </div>
      )}

      {req.status === "FAILED" && (
        <div className="pt-2 border-t border-[var(--border)]">
          <p className="text-xs text-red-400/80 bg-red-500/5 px-3 py-2 rounded-xl">
            Auto-payout ล้มเหลว — ตรวจสอบ adminNote ด้านบน ติดต่อ Omise หรือโอนด้วยตนเอง
          </p>
        </div>
      )}
    </div>
  );
}

export default function WithdrawalsAdmin({ requests }: { requests: Request[] }) {
  const [filter, setFilter] = useState<"ALL" | "PENDING" | "PROCESSING" | "APPROVED" | "PAID" | "REJECTED" | "FAILED">("PENDING");
  const [, setRefreshKey] = useState(0);

  const filtered = filter === "ALL" ? requests : requests.filter((r) => r.status === filter);
  const pendingCount = requests.filter((r) => r.status === "PENDING").length;
  const processingCount = requests.filter((r) => r.status === "PROCESSING").length;

  const TABS = ["PENDING", "PROCESSING", "APPROVED", "PAID", "REJECTED", "FAILED", "ALL"] as const;

  return (
    <div className="space-y-6">
      {/* Summary badges */}
      {(pendingCount > 0 || processingCount > 0) && (
        <div className="flex gap-3 flex-wrap">
          {pendingCount > 0 && (
            <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl px-3 py-2 text-center">
              <p className="text-sm font-bold text-yellow-400">{pendingCount} รายการ</p>
              <p className="text-xs text-yellow-600">รอดำเนินการ (Manual)</p>
            </div>
          )}
          {processingCount > 0 && (
            <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl px-3 py-2 text-center">
              <p className="text-sm font-bold text-blue-400">{processingCount} รายการ</p>
              <p className="text-xs text-blue-600">Omise กำลังโอน</p>
            </div>
          )}
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
        {TABS.map((f) => {
          const count = f === "PENDING" ? pendingCount : f === "PROCESSING" ? processingCount : 0;
          return (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={clsx(
                "whitespace-nowrap px-3 py-1.5 rounded-xl text-xs font-medium transition-colors shrink-0",
                filter === f ? "bg-white/10 text-[var(--text-primary)]" : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              )}
            >
              {f === "ALL" ? "ทั้งหมด" : (STATUS_STYLE[f]?.label ?? f)}
              {count > 0 && (
                <span className={clsx(
                  "ml-1.5 px-1.5 py-0.5 rounded-full text-xs",
                  f === "PROCESSING" ? "bg-blue-500/30 text-blue-400" : "bg-yellow-500/30 text-yellow-400"
                )}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {filtered.length === 0 ? (
        <p className="text-center py-12 text-[var(--text-muted)] text-sm">ไม่มีรายการ</p>
      ) : (
        <div className="space-y-4">
          {filtered.map((r) => (
            <RequestCard key={r.id} req={r} onAction={() => setRefreshKey((k) => k + 1)} />
          ))}
        </div>
      )}
    </div>
  );
}
