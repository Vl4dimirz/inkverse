"use client";

import { ShieldAlert, X, Check, Eye, EyeOff } from "lucide-react";

/**
 * Confirmation shown when a creator marks a work as 18+ (ADULT). Explains where
 * the content will appear, where it's hidden, and why — then requires an explicit
 * second confirmation before saving.
 */
export default function Adult18ConfirmModal({
  open,
  onConfirm,
  onCancel,
  loading = false,
}: {
  open: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  loading?: boolean;
}) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-[130] flex items-center justify-center p-4 bg-black/75"
      onClick={onCancel}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative max-w-md w-full bg-[var(--bg-surface)] border border-[var(--border)] rounded-2xl p-6 max-h-[90vh] overflow-y-auto"
      >
        <button
          onClick={onCancel}
          aria-label="ปิด"
          className="absolute top-3 right-3 w-8 h-8 flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-2 mb-1">
          <ShieldAlert className="w-5 h-5 text-[var(--text-primary)]" />
          <h2 className="font-bebas text-2xl text-[var(--text-primary)] tracking-wide">
            ยืนยันเนื้อหา 18+
          </h2>
        </div>
        <p className="text-sm text-[var(--text-secondary)] mb-4 leading-relaxed">
          คุณกำลังตั้งเรื่องนี้เป็น <span className="text-[var(--text-primary)] font-semibold">เนื้อหาผู้ใหญ่ (18+)</span> โปรดอ่านก่อนยืนยัน — การตั้งค่านี้มีผลกับการมองเห็นของผู้อ่าน:
        </p>

        {/* Where it shows */}
        <div className="flex items-start gap-2.5 border border-[var(--border)] rounded-xl p-3 mb-2.5">
          <Eye className="w-4 h-4 text-[var(--text-primary)] shrink-0 mt-0.5" />
          <div className="text-xs leading-relaxed">
            <p className="text-[var(--text-primary)] font-semibold mb-0.5">แสดงบนเว็บ (เปิดผ่านเบราว์เซอร์)</p>
            <p className="text-[var(--text-secondary)]">
              โผล่ในฟีดอัปเดตล่าสุด ค้นหา หน้าหมวดหมู่ และรายการทั้งหมด — ติดป้าย <span className="text-[var(--text-primary)] font-semibold">18+</span> และผู้อ่านต้องยืนยันอายุก่อนเปิดอ่าน
            </p>
          </div>
        </div>

        {/* Where it's hidden */}
        <div className="flex items-start gap-2.5 border border-[var(--border)] rounded-xl p-3 mb-2.5">
          <EyeOff className="w-4 h-4 text-[var(--text-primary)] shrink-0 mt-0.5" />
          <div className="text-xs leading-relaxed">
            <p className="text-[var(--text-primary)] font-semibold mb-0.5">ซ่อนในแอป INKVERSE (Android)</p>
            <p className="text-[var(--text-secondary)]">
              ไม่แสดงทุกที่ในแอป (ฟีด ค้นหา รายการ) — ผู้ใช้แอปจะมองไม่เห็นเรื่องนี้เลย
            </p>
          </div>
        </div>

        {/* Why */}
        <div className="text-xs text-[var(--text-muted)] leading-relaxed mb-5 px-1">
          <span className="text-[var(--text-secondary)] font-semibold">ทำไมถึงซ่อนในแอป:</span> Google Play
          ไม่อนุญาตให้แอปแสดงเนื้อหา 18+ แบบเปิดเผย ถ้าแอปแสดงอาจถูกถอดออกจาก Store — เราจึงจำกัดให้ 18+
          เห็นเฉพาะบนเว็บที่มีด่านยืนยันอายุ เพื่อปกป้องผู้เยาว์และให้แอปอยู่รอด
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="flex-1 border border-[var(--border)] py-2.5 rounded-xl text-xs uppercase tracking-widest text-[var(--text-secondary)] hover:border-[var(--text-primary)] hover:text-[var(--text-primary)] transition-colors disabled:opacity-50"
          >
            ยกเลิก
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className="flex-1 bal-btn py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <Check className="w-4 h-4" /> ยืนยันว่าเป็น 18+
          </button>
        </div>
      </div>
    </div>
  );
}
