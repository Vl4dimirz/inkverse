"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { signOut } from "next-auth/react";
import {
  User, LayoutDashboard, Settings, LogOut, Coins, Shield, Upload, ChevronDown, Gift, MessageSquare, Trophy, Medal, PenTool,
} from "lucide-react";
import RankChip from "./RankChip";
import type { RankBadge } from "@/lib/ranks";

interface MenuUser {
  name?: string | null;
  username?: string | null;
  email?: string | null;
  image?: string | null;
  role?: string;
}

export default function UserMenu({ user, rankBadge }: { user: MenuUser; rankBadge?: RankBadge | null }) {
  const ringClass =
    rankBadge?.kind === "admin"
      ? "ring-2 ring-[var(--text-primary)]"
      : rankBadge
      ? "ring-1 ring-[var(--text-primary)]/40"
      : "";
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const username = user.name || "ผู้ใช้";
  const isAdmin = user.role === "ADMIN";
  const isStaff = isAdmin || user.role === "TRANSLATOR";
  const item =
    "flex items-center gap-2.5 w-full px-3 py-2 text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-card)] hover:text-[var(--text-primary)] transition-colors";

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="เมนูผู้ใช้"
        className="flex items-center gap-1 p-0.5 rounded-full hover:bg-white/10 transition-colors"
      >
        <span className={`w-8 h-8 rounded-full overflow-hidden bg-[var(--accent)] flex items-center justify-center text-white text-sm font-semibold shrink-0 ${ringClass}`}>
          {user.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={user.image} alt="" className="w-full h-full object-cover" />
          ) : (
            username[0]?.toUpperCase() || "U"
          )}
        </span>
        <ChevronDown className="w-3.5 h-3.5 text-[var(--text-secondary)] hidden sm:block" />
      </button>

      {open && (
        <div
          onClick={() => setOpen(false)}
          className="absolute right-0 mt-2 w-56 rounded-xl bg-[var(--bg-surface)] border border-[var(--border)]  overflow-hidden z-50 py-1"
        >
          <div className="px-3 py-2.5 border-b border-[var(--border)]">
            <p className="text-sm font-semibold text-[var(--text-primary)] truncate">{username}</p>
            {user.email && <p className="text-xs text-[var(--text-secondary)] truncate">{user.email}</p>}
            {rankBadge && (
              <div className="mt-1.5">
                <RankChip badge={rankBadge} />
              </div>
            )}
          </div>

          <Link href={`/profile/${user.username ?? user.name}`} className={item}>
            <User className="w-4 h-4" /> โปรไฟล์ของฉัน
          </Link>
          {isStaff && (
            <Link href="/dashboard" className={item}>
              <LayoutDashboard className="w-4 h-4" /> แดชบอร์ด
            </Link>
          )}
          {isStaff && (
            <Link href="/dashboard/new-novel" className={item}>
              <PenTool className="w-4 h-4" /> เขียนนิยาย
            </Link>
          )}
          {user.role === "TRANSLATOR" && (
            <Link href="/upload" className={item}>
              <Upload className="w-4 h-4" /> อัปโหลดมังงะ
            </Link>
          )}
          {isAdmin && (
            <Link href="/admin" className={item}>
              <Shield className="w-4 h-4" /> แอดมิน
            </Link>
          )}
          <Link href="/topup" className={item}>
            <Coins className="w-4 h-4" /> เติมเหรียญ
          </Link>
          <Link href="/achievements" className={item}>
            <Trophy className="w-4 h-4" /> ความสำเร็จ
          </Link>
          <Link href="/leaderboard" className={item}>
            <Medal className="w-4 h-4" /> อันดับนักอ่าน
          </Link>
          <Link href="/referral" className={item}>
            <Gift className="w-4 h-4" /> ชวนเพื่อน
          </Link>
          <Link href="/settings" className={item}>
            <Settings className="w-4 h-4" /> ตั้งค่า
          </Link>
          <Link href="/contact" className={item}>
            <MessageSquare className="w-4 h-4" /> ติดต่อแอดมิน
          </Link>

          <button
            onClick={() => signOut({ callbackUrl: "/" })}
            className={`${item} text-[var(--text-primary)] hover:text-[var(--text-primary)] border-t border-[var(--border)] mt-1`}
          >
            <LogOut className="w-4 h-4" /> ออกจากระบบ
          </button>
        </div>
      )}
    </div>
  );
}
