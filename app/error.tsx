"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center text-center px-4">
      <div className="w-16 h-16 rounded-2xl bg-[var(--text-primary)]/10 border border-[var(--text-primary)]/30 flex items-center justify-center mb-4">
        <AlertTriangle className="w-8 h-8 text-[var(--text-primary)]" />
      </div>
      <h1 className="text-xl font-semibold text-[var(--text-primary)]">เกิดข้อผิดพลาด</h1>
      <p className="text-sm text-[var(--text-secondary)] mt-2 max-w-md">
        ระบบขัดข้องชั่วคราว กรุณาลองใหม่อีกครั้ง หากยังเป็นอยู่กรุณาติดต่อผู้ดูแลระบบ
      </p>
      {error.digest && (
        <p className="text-xs text-[var(--text-muted)] mt-2 font-mono">รหัสอ้างอิง: {error.digest}</p>
      )}
      <div className="flex flex-wrap justify-center gap-3 mt-7">
        <button
          onClick={reset}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[var(--accent)] text-[var(--text-primary)] text-sm font-semibold hover:opacity-90 transition-opacity"
        >
          <RefreshCw className="w-4 h-4" /> ลองใหม่
        </button>
        <Link
          href="/"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[var(--bg-card)] border border-[var(--border)] text-[var(--text-primary)] text-sm font-semibold hover:border-white/30 transition-colors"
        >
          <Home className="w-4 h-4" /> หน้าแรก
        </Link>
      </div>
    </div>
  );
}
