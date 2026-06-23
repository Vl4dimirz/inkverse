"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Check, AlertCircle, Eye, EyeOff, ShieldCheck, ShieldOff } from "lucide-react";

const field =
  "w-full bg-[var(--bg-card)] border border-[var(--border)] px-3 py-2.5 text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--text-primary)]/50 transition-colors";
const label =
  "block text-xs text-[var(--text-secondary)] uppercase tracking-wider mb-1.5";

// ── Password change section ──────────────────────────────────────────────────

function PasswordSection() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNext, setShowNext] = useState(false);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<"" | "ok" | "error">("");
  const [msg, setMsg] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (next !== confirm) {
      setResult("error");
      setMsg("รหัสผ่านใหม่ไม่ตรงกัน กรุณากรอกใหม่");
      return;
    }
    if (next.length < 8) {
      setResult("error");
      setMsg("รหัสผ่านใหม่ต้องมีอย่างน้อย 8 ตัวอักษร");
      return;
    }
    setSaving(true);
    setResult("");
    setMsg("");
    try {
      const res = await fetch("/api/account/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: current, newPassword: next }),
      });
      const d = await res.json().catch(() => ({}));
      if (res.ok) {
        setResult("ok");
        setMsg("เปลี่ยนรหัสผ่านสำเร็จ");
        setCurrent("");
        setNext("");
        setConfirm("");
      } else {
        setResult("error");
        setMsg((d as { message?: string }).message ?? "เปลี่ยนรหัสผ่านไม่สำเร็จ กรุณาลองใหม่");
      }
    } catch {
      setResult("error");
      setMsg("เครือข่ายขัดข้อง กรุณาลองใหม่");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="border border-[var(--border)] bg-[var(--bg-surface)] p-5 space-y-4">
      <p className="eyebrow">เปลี่ยนรหัสผ่าน</p>

      <form onSubmit={submit} className="space-y-4">
        {/* Current password */}
        <div>
          <label className={label}>รหัสผ่านปัจจุบัน</label>
          <div className="relative">
            <input
              type={showCurrent ? "text" : "password"}
              className={`${field} pr-10`}
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
              required
              autoComplete="current-password"
            />
            <button
              type="button"
              onClick={() => setShowCurrent((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              tabIndex={-1}
            >
              {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* New password */}
        <div>
          <label className={label}>รหัสผ่านใหม่ (อย่างน้อย 8 ตัวอักษร)</label>
          <div className="relative">
            <input
              type={showNext ? "text" : "password"}
              className={`${field} pr-10`}
              value={next}
              onChange={(e) => setNext(e.target.value)}
              required
              minLength={8}
              autoComplete="new-password"
            />
            <button
              type="button"
              onClick={() => setShowNext((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              tabIndex={-1}
            >
              {showNext ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Confirm */}
        <div>
          <label className={label}>ยืนยันรหัสผ่านใหม่</label>
          <input
            type="password"
            className={field}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
            autoComplete="new-password"
          />
        </div>

        {result && (
          <div
            className={`flex items-start gap-2 border px-3 py-2.5 text-sm ${
              result === "ok"
                ? "border-[var(--border)] text-[var(--text-primary)]"
                : "border-[var(--border)] text-[var(--text-primary)]"
            }`}
          >
            {result === "ok" ? (
              <Check className="w-4 h-4 shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            )}
            {msg}
          </div>
        )}

        <button
          type="submit"
          disabled={saving}
          className="w-full bal-btn py-2.5 text-sm flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
          เปลี่ยนรหัสผ่าน
        </button>
      </form>
    </div>
  );
}

// ── 2FA section ─────────────────────────────────────────────────────────────

type SetupData = { secret: string; qrDataUrl: string };

function TwoFactorSection({ twoFactorEnabled }: { twoFactorEnabled: boolean }) {
  const router = useRouter();
  const [enabled, setEnabled] = useState(twoFactorEnabled);

  // Setup flow
  const [setupData, setSetupData] = useState<SetupData | null>(null);
  const [setupCode, setSetupCode] = useState("");
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [disablePassword, setDisablePassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [isError, setIsError] = useState(false);

  function showMsg(text: string, error = false) {
    setMsg(text);
    setIsError(error);
  }

  // Start setup
  async function startSetup() {
    setLoading(true);
    showMsg("");
    try {
      const res = await fetch("/api/account/2fa/setup", { method: "POST" });
      const d = await res.json().catch(() => ({}));
      if (res.ok) {
        setSetupData(d as SetupData);
      } else {
        showMsg((d as { message?: string }).message ?? "เกิดข้อผิดพลาด กรุณาลองใหม่", true);
      }
    } catch {
      showMsg("เครือข่ายขัดข้อง กรุณาลองใหม่", true);
    } finally {
      setLoading(false);
    }
  }

  // Confirm 2FA
  async function confirmEnable(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    showMsg("");
    try {
      const res = await fetch("/api/account/2fa/enable", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: setupCode }),
      });
      const d = await res.json().catch(() => ({}));
      if (res.ok && (d as { ok?: boolean }).ok) {
        setBackupCodes((d as { backupCodes: string[] }).backupCodes ?? []);
        setEnabled(true);
        setSetupData(null);
        setSetupCode("");
        router.refresh();
      } else {
        showMsg((d as { message?: string }).message ?? "รหัสไม่ถูกต้อง กรุณาลองใหม่", true);
      }
    } catch {
      showMsg("เครือข่ายขัดข้อง กรุณาลองใหม่", true);
    } finally {
      setLoading(false);
    }
  }

  // Disable 2FA
  async function disable(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    showMsg("");
    try {
      const res = await fetch("/api/account/2fa/disable", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: disablePassword }),
      });
      const d = await res.json().catch(() => ({}));
      if (res.ok && (d as { ok?: boolean }).ok) {
        setEnabled(false);
        setDisablePassword("");
        showMsg("ปิด 2FA สำเร็จ");
        router.refresh();
      } else {
        showMsg((d as { message?: string }).message ?? "รหัสผ่านไม่ถูกต้อง กรุณาลองใหม่", true);
      }
    } catch {
      showMsg("เครือข่ายขัดข้อง กรุณาลองใหม่", true);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="border border-[var(--border)] bg-[var(--bg-surface)] p-5 space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="eyebrow mb-2">การยืนยันตัวตนสองขั้นตอน (2FA)</p>
          <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
            เพิ่มความปลอดภัยให้บัญชีด้วยรหัส 6 หลักจากแอปยืนยันตัวตน (เช่น Google Authenticator, Authy)
            ทุกครั้งที่เข้าสู่ระบบจะต้องกรอกรหัสนี้เพิ่มเติม
          </p>
        </div>
        {enabled ? (
          <ShieldCheck className="w-6 h-6 text-[var(--text-primary)] shrink-0 mt-1" />
        ) : (
          <ShieldOff className="w-6 h-6 text-[var(--text-muted)] shrink-0 mt-1" />
        )}
      </div>

      {/* Status badge */}
      <div className="flex items-center gap-2">
        <span
          className={`text-[10px] uppercase tracking-widest px-2 py-1 border ${
            enabled
              ? "border-[var(--text-primary)] text-[var(--text-primary)]"
              : "border-[var(--border)] text-[var(--text-muted)]"
          }`}
        >
          {enabled ? "เปิดใช้งานอยู่" : "ปิดอยู่"}
        </span>
      </div>

      {/* Backup codes display (shown right after enable) */}
      {backupCodes.length > 0 && (
        <div className="border border-[var(--text-primary)] bg-[var(--bg-card)] p-4 space-y-3">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-[var(--text-primary)]" />
            <p className="text-sm font-semibold text-[var(--text-primary)]">
              บันทึกรหัสสำรองนี้ไว้ — จะแสดงครั้งเดียวเท่านั้น
            </p>
          </div>
          <p className="text-xs text-[var(--text-secondary)]">
            หากสูญหายแอปยืนยันตัวตน ใช้รหัสเหล่านี้เพื่อเข้าสู่ระบบแทน (ใช้ได้ครั้งละ 1 รหัส)
          </p>
          <div className="grid grid-cols-2 gap-2">
            {backupCodes.map((code) => (
              <code
                key={code}
                className="block text-center font-mono text-sm bg-[var(--bg-primary)] border border-[var(--border)] py-2 text-[var(--text-primary)]"
              >
                {code}
              </code>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setBackupCodes([])}
            className="text-xs text-[var(--text-muted)] underline uppercase tracking-wider"
          >
            บันทึกแล้ว — ปิด
          </button>
        </div>
      )}

      {/* Feedback message */}
      {msg && (
        <div
          className={`flex items-start gap-2 border px-3 py-2.5 text-sm border-[var(--border)] text-[var(--text-primary)]`}
        >
          {isError ? (
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          ) : (
            <Check className="w-4 h-4 shrink-0 mt-0.5" />
          )}
          {msg}
        </div>
      )}

      {/* Not enabled — setup flow */}
      {!enabled && backupCodes.length === 0 && (
        <>
          {!setupData ? (
            <button
              type="button"
              onClick={startSetup}
              disabled={loading}
              className="w-full bal-btn py-2.5 text-sm flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              เปิดใช้งาน 2FA
            </button>
          ) : (
            <div className="space-y-4">
              <p className="text-xs text-[var(--text-secondary)]">
                สแกน QR ด้านล่างด้วยแอป Google Authenticator หรือ Authy
                แล้วกรอกรหัส 6 หลักเพื่อยืนยัน
              </p>

              {/* QR */}
              <div className="flex justify-center">
                <div className="bg-white p-3 inline-block">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={setupData.qrDataUrl}
                    alt="2FA QR Code"
                    width={180}
                    height={180}
                    className="block"
                  />
                </div>
              </div>

              {/* Manual entry secret */}
              <div>
                <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider mb-1.5">
                  หรือกรอกรหัสลับด้วยตนเอง
                </p>
                <code className="block w-full font-mono text-sm bg-[var(--bg-card)] border border-[var(--border)] px-3 py-2.5 text-[var(--text-primary)] break-all select-all">
                  {setupData.secret}
                </code>
              </div>

              {/* Verify code */}
              <form onSubmit={confirmEnable} className="space-y-3">
                <div>
                  <label className={label}>รหัส 6 หลักจากแอป</label>
                  <input
                    className={field}
                    value={setupCode}
                    onChange={(e) =>
                      setSetupCode(e.target.value.replace(/\D/g, "").slice(0, 6))
                    }
                    placeholder="000000"
                    maxLength={6}
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    required
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => { setSetupData(null); setSetupCode(""); showMsg(""); }}
                    className="flex-1 border border-[var(--border)] py-2.5 text-xs uppercase tracking-widest text-[var(--text-secondary)] hover:border-[var(--text-primary)] hover:text-[var(--text-primary)] transition-colors"
                  >
                    ยกเลิก
                  </button>
                  <button
                    type="submit"
                    disabled={loading || setupCode.length !== 6}
                    className="flex-1 bal-btn py-2.5 text-sm flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                    ยืนยัน
                  </button>
                </div>
              </form>
            </div>
          )}
        </>
      )}

      {/* Enabled — disable flow */}
      {enabled && backupCodes.length === 0 && (
        <form onSubmit={disable} className="space-y-3">
          <div>
            <label className={label}>กรอกรหัสผ่านเพื่อปิด 2FA</label>
            <input
              type="password"
              className={field}
              value={disablePassword}
              onChange={(e) => setDisablePassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </div>
          <button
            type="submit"
            disabled={loading || !disablePassword}
            className="w-full border border-[var(--border)] py-2.5 text-xs uppercase tracking-widest text-[var(--text-secondary)] hover:border-[var(--text-primary)] hover:text-[var(--text-primary)] transition-colors disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin inline mr-1.5" />
            ) : null}
            ปิด 2FA
          </button>
        </form>
      )}
    </div>
  );
}

// ── Export ───────────────────────────────────────────────────────────────────

export default function SecurityTab({
  twoFactorEnabled,
}: {
  twoFactorEnabled: boolean;
}) {
  return (
    <div className="space-y-5">
      <PasswordSection />
      <TwoFactorSection twoFactorEnabled={twoFactorEnabled} />
    </div>
  );
}
