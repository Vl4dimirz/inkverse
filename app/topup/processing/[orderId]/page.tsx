"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";

export default function ProcessingPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const router = useRouter();
  const [status, setStatus] = useState<"checking" | "failed">("checking");
  const [orderId, setOrderId] = useState<string>("");
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    params.then(({ orderId: id }) => {
      setOrderId(id);

      let attempts = 0;
      const MAX = 150; // 5 minutes at 2s interval

      pollRef.current = setInterval(async () => {
        attempts++;
        try {
          const res = await fetch(`/api/coin/order/${id}/status`);
          if (res.ok) {
            const data = await res.json();
            if (data.status === "PAID") {
              clearInterval(pollRef.current!);
              router.push(`/topup/success/${id}`);
              return;
            }
            if (data.status === "FAILED" || data.status === "CANCELLED") {
              clearInterval(pollRef.current!);
              setStatus("failed");
              return;
            }
          }
        } catch { /* ignore */ }

        if (attempts >= MAX) {
          clearInterval(pollRef.current!);
          setStatus("failed");
        }
      }, 2000);
    });

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [params, router]);

  if (status === "failed") {
    return (
      <div className="min-h-[70vh] flex items-center justify-center px-4">
        <div className="w-full max-w-sm text-center space-y-5">
          <div className="flex justify-center">
            <div className="w-16 h-16 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center">
              <XCircle className="w-8 h-8 text-red-400" />
            </div>
          </div>
          <h2 className="text-xl font-bold text-[var(--text-primary)]">การชำระเงินไม่สำเร็จ</h2>
          <p className="text-sm text-[var(--text-secondary)]">
            ไม่พบการยืนยันการชำระเงิน กรุณาลองใหม่อีกครั้ง
          </p>
          <button
            onClick={() => router.push(orderId ? `/topup/checkout/${orderId}` : "/topup")}
            className="w-full py-3 rounded-xl bg-[var(--accent)] text-[var(--text-primary)] font-semibold text-sm hover:opacity-90 transition-opacity"
          >
            ลองใหม่
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4">
      <div className="w-full max-w-sm text-center space-y-5">
        <div className="flex justify-center">
          <div className="w-16 h-16 rounded-full bg-[var(--text-primary)]/10 border border-[var(--text-primary)]/20 flex items-center justify-center">
            <Loader2 className="w-8 h-8 text-[var(--text-primary)] animate-spin" />
          </div>
        </div>
        <h2 className="text-xl font-bold text-[var(--text-primary)]">กำลังตรวจสอบการชำระเงิน</h2>
        <p className="text-sm text-[var(--text-secondary)]">
          หน้านี้จะอัปเดตอัตโนมัติ กรุณาอย่าปิดหน้าต่าง
        </p>
        <div className="flex items-center justify-center gap-2 text-xs text-[var(--text-muted)]">
          <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
          <span>ระบบกำลังรอการยืนยันจากธนาคาร / wallet</span>
        </div>
      </div>
    </div>
  );
}
