"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Monitor, Smartphone, AlertCircle, LogOut } from "lucide-react";

type Session = {
  id: string;
  device: string;
  ip: string;
  lastSeenAt: string;
  createdAt: string;
  current: boolean;
};

function relativeTime(isoStr: string): string {
  const diff = Date.now() - new Date(isoStr).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "เมื่อกี้";
  if (minutes < 60) return `${minutes} นาทีที่แล้ว`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} ชั่วโมงที่แล้ว`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} วันที่แล้ว`;
  return new Date(isoStr).toLocaleDateString("th-TH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function deviceIcon(device: string) {
  const lower = device.toLowerCase();
  if (
    lower.includes("mobile") ||
    lower.includes("android") ||
    lower.includes("iphone") ||
    lower.includes("ipad")
  ) {
    return <Smartphone className="w-5 h-5 text-[var(--text-muted)] shrink-0" />;
  }
  return <Monitor className="w-5 h-5 text-[var(--text-muted)] shrink-0" />;
}

export default function DevicesTab() {
  const router = useRouter();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState("");
  const [revoking, setRevoking] = useState<string | null>(null);
  const [revokingAll, setRevokingAll] = useState(false);
  const [actionMsg, setActionMsg] = useState("");

  const loadSessions = useCallback(async () => {
    setLoading(true);
    setFetchError("");
    try {
      const res = await fetch("/api/account/sessions");
      const d = await res.json().catch(() => ({}));
      if (res.ok) {
        setSessions((d as { sessions: Session[] }).sessions ?? []);
      } else {
        setFetchError(
          (d as { message?: string }).message ?? "โหลดข้อมูลอุปกรณ์ไม่สำเร็จ"
        );
      }
    } catch {
      setFetchError("เครือข่ายขัดข้อง กรุณารีเฟรชหน้า");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSessions();
  }, [loadSessions]);

  async function revokeSession(id: string) {
    setRevoking(id);
    setActionMsg("");
    try {
      const res = await fetch(`/api/account/sessions/${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        await loadSessions();
        router.refresh();
      } else {
        const d = await res.json().catch(() => ({}));
        setActionMsg(
          (d as { message?: string }).message ?? "ออกจากระบบอุปกรณ์ไม่สำเร็จ"
        );
      }
    } catch {
      setActionMsg("เครือข่ายขัดข้อง กรุณาลองใหม่");
    } finally {
      setRevoking(null);
    }
  }

  async function revokeOthers() {
    setRevokingAll(true);
    setActionMsg("");
    try {
      const res = await fetch("/api/account/sessions/revoke-others", {
        method: "POST",
      });
      const d = await res.json().catch(() => ({}));
      if (res.ok) {
        setActionMsg(
          `ออกจากระบบอุปกรณ์อื่นสำเร็จ (${(d as { count?: number }).count ?? 0} อุปกรณ์)`
        );
        await loadSessions();
        router.refresh();
      } else {
        setActionMsg(
          (d as { message?: string }).message ?? "เกิดข้อผิดพลาด กรุณาลองใหม่"
        );
      }
    } catch {
      setActionMsg("เครือข่ายขัดข้อง กรุณาลองใหม่");
    } finally {
      setRevokingAll(false);
    }
  }

  const othersCount = sessions.filter((s) => !s.current).length;

  return (
    <div className="space-y-5">
      {/* Explainer */}
      <p className="text-xs text-[var(--text-muted)] leading-relaxed">
        รายการนี้แสดงอุปกรณ์ที่เข้าสู่ระบบบัญชีคุณ
        หากพบอุปกรณ์ที่ไม่รู้จัก ให้กดออกจากระบบทันทีและเปลี่ยนรหัสผ่าน
      </p>

      {/* Session list */}
      <div className="border border-[var(--border)] bg-[var(--bg-surface)]">
        {loading && (
          <div className="flex justify-center items-center py-10">
            <Loader2 className="w-5 h-5 animate-spin text-[var(--text-muted)]" />
          </div>
        )}

        {!loading && fetchError && (
          <div className="flex items-start gap-2 p-5 text-sm text-[var(--text-primary)]">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            {fetchError}
          </div>
        )}

        {!loading && !fetchError && sessions.length === 0 && (
          <div className="py-10 text-center">
            <p className="text-sm text-[var(--text-muted)]">
              ยังไม่มีข้อมูลอุปกรณ์ (ระบบอาจยังอยู่ระหว่างเปิดใช้งาน)
            </p>
          </div>
        )}

        {!loading && sessions.length > 0 && (
          <ul className="divide-y divide-[var(--border)]">
            {sessions.map((s) => (
              <li key={s.id} className="flex items-start gap-3 px-4 py-4">
                {deviceIcon(s.device)}

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm text-[var(--text-primary)] truncate">
                      {s.device || "อุปกรณ์ไม่ทราบ"}
                    </span>
                    {s.current && (
                      <span className="shrink-0 text-[10px] uppercase tracking-widest border border-[var(--text-primary)] text-[var(--text-primary)] px-1.5 py-0.5">
                        อุปกรณ์นี้
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-[var(--text-muted)] mt-0.5">
                    {s.ip} · ใช้งานล่าสุด {relativeTime(s.lastSeenAt)}
                  </p>
                </div>

                {!s.current && (
                  <button
                    type="button"
                    onClick={() => revokeSession(s.id)}
                    disabled={revoking === s.id}
                    className="shrink-0 inline-flex items-center gap-1.5 border border-[var(--border)] px-3 py-1.5 text-xs uppercase tracking-wider text-[var(--text-secondary)] hover:border-[var(--text-primary)] hover:text-[var(--text-primary)] transition-colors disabled:opacity-50"
                  >
                    {revoking === s.id ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <LogOut className="w-3.5 h-3.5" />
                    )}
                    ออกจากระบบ
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Action message */}
      {actionMsg && (
        <p className="text-xs text-[var(--text-secondary)] border border-[var(--border)] px-3 py-2.5">
          {actionMsg}
        </p>
      )}

      {/* Revoke all others */}
      {!loading && othersCount > 0 && (
        <button
          type="button"
          onClick={revokeOthers}
          disabled={revokingAll}
          className="w-full border border-[var(--border)] py-2.5 text-xs uppercase tracking-widest text-[var(--text-secondary)] hover:border-[var(--text-primary)] hover:text-[var(--text-primary)] transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {revokingAll ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <LogOut className="w-3.5 h-3.5" />
          )}
          ออกจากระบบอุปกรณ์อื่นทั้งหมด ({othersCount})
        </button>
      )}
    </div>
  );
}
