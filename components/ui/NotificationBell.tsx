"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import {
  Bell,
  CheckCircle,
  XCircle,
  Banknote,
  Clock,
  Coins,
  Trash2,
  Check,
} from "lucide-react";
import clsx from "clsx";

interface Notification {
  id: string;
  type: string;
  title: string;
  body: string;
  isRead: boolean;
  link?: string | null;
  createdAt: string;
}

function typeIcon(type: string) {
  switch (type) {
    case "APPLICATION_APPROVED":
      return <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0" />;
    case "APPLICATION_REJECTED":
      return <XCircle className="w-4 h-4 text-red-400 flex-shrink-0" />;
    case "WITHDRAWAL_PAID":
      return <Banknote className="w-4 h-4 text-green-400 flex-shrink-0" />;
    case "WITHDRAWAL_APPROVED":
      return <Clock className="w-4 h-4 text-blue-400 flex-shrink-0" />;
    case "WITHDRAWAL_REJECTED":
      return <XCircle className="w-4 h-4 text-red-400 flex-shrink-0" />;
    case "TOPUP_SUCCESS":
      return <Coins className="w-4 h-4 text-yellow-400 flex-shrink-0" />;
    default:
      return <Bell className="w-4 h-4 text-[var(--text-secondary)] flex-shrink-0" />;
  }
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "เมื่อกี้";
  if (m < 60) return `${m} นาทีที่แล้ว`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} ชั่วโมงที่แล้ว`;
  const d = Math.floor(h / 24);
  return `${d} วันที่แล้ว`;
}

export default function NotificationBell() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications");
      if (!res.ok) return;
      const data = await res.json();
      setNotifications(data.notifications ?? []);
      setUnreadCount(data.unreadCount ?? 0);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  // Close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  async function markAllRead() {
    await fetch("/api/notifications", { method: "PATCH" });
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    setUnreadCount(0);
  }

  async function markRead(id: string) {
    await fetch(`/api/notifications/${id}`, { method: "PATCH" });
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
    );
    setUnreadCount((c) => Math.max(0, c - 1));
  }

  async function deleteNotification(id: string, wasRead: boolean) {
    await fetch(`/api/notifications/${id}`, { method: "DELETE" });
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    if (!wasRead) setUnreadCount((c) => Math.max(0, c - 1));
  }

  function handleOpen() {
    setOpen((v) => !v);
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={handleOpen}
        className="p-2 rounded-lg hover:bg-white/10 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors relative"
        aria-label="การแจ้งเตือน"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-0.5 flex items-center justify-center rounded-full bg-[var(--text-primary)] text-[var(--text-primary)] text-[10px] font-bold leading-none">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-[var(--bg-surface)] border border-[var(--border)] rounded-2xl shadow-2xl overflow-hidden z-50">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
            <span className="text-sm font-semibold text-[var(--text-primary)]">การแจ้งเตือน</span>
            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                className="flex items-center gap-1 text-xs text-[var(--text-primary)] hover:text-[var(--text-primary)] transition-colors"
              >
                <Check className="w-3 h-3" />
                อ่านทั้งหมด
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-[360px] overflow-y-auto divide-y divide-white/5">
            {notifications.length === 0 ? (
              <div className="py-10 text-center text-[var(--text-secondary)] text-sm">
                <Bell className="w-8 h-8 mx-auto mb-2 opacity-30" />
                ไม่มีการแจ้งเตือน
              </div>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  className={clsx(
                    "flex items-start gap-3 px-4 py-3 group transition-colors",
                    !n.isRead ? "bg-[var(--text-primary)]/5" : "hover:bg-white/5"
                  )}
                >
                  <div className="mt-0.5">{typeIcon(n.type)}</div>
                  <div
                    className="flex-1 min-w-0 cursor-pointer"
                    onClick={() => {
                      if (!n.isRead) markRead(n.id);
                      if (n.link) {
                        setOpen(false);
                      }
                    }}
                  >
                    {n.link ? (
                      <Link href={n.link} onClick={() => setOpen(false)}>
                        <p className={clsx("text-xs font-medium leading-snug", !n.isRead ? "text-[var(--text-primary)]" : "text-[var(--text-primary)]")}>
                          {n.title}
                        </p>
                        <p className="text-xs text-[var(--text-secondary)] mt-0.5 line-clamp-2">{n.body}</p>
                        <p className="text-[10px] text-[var(--text-muted)] mt-1">{timeAgo(n.createdAt)}</p>
                      </Link>
                    ) : (
                      <>
                        <p className={clsx("text-xs font-medium leading-snug", !n.isRead ? "text-[var(--text-primary)]" : "text-[var(--text-primary)]")}>
                          {n.title}
                        </p>
                        <p className="text-xs text-[var(--text-secondary)] mt-0.5 line-clamp-2">{n.body}</p>
                        <p className="text-[10px] text-[var(--text-muted)] mt-1">{timeAgo(n.createdAt)}</p>
                      </>
                    )}
                  </div>
                  <button
                    onClick={() => deleteNotification(n.id, n.isRead)}
                    className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-white/10 text-[var(--text-secondary)] hover:text-red-400 transition-all flex-shrink-0"
                    aria-label="ลบ"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
