"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { signOut } from "next-auth/react";
import {
  User, LayoutDashboard, Settings, LogOut, Coins, Shield, Upload, ChevronDown, Gift, MessageSquare, Trophy, Medal, PenTool, Share2, WifiOff,
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

const itemCls =
  "flex items-center gap-2.5 w-full px-3 py-2 text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-card)] hover:text-[var(--text-primary)] transition-colors";
const subCls =
  "flex items-center gap-2.5 w-full pl-9 pr-3 py-2 text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-card)] hover:text-[var(--text-primary)] transition-colors";

// A collapsible group ("dropbar in dropbar"). stopPropagation so toggling doesn't
// close the whole menu (the dropdown closes on any click).
function Section({
  label,
  Icon,
  open,
  onToggle,
  children,
}: {
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="border-t border-[var(--border)]/40">
      <button
        onClick={(e) => {
          e.stopPropagation();
          onToggle();
        }}
        className="flex items-center justify-between w-full px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
      >
        <span className="flex items-center gap-2.5">
          <Icon className="w-3.5 h-3.5" /> {label}
        </span>
        <ChevronDown className={`w-3.5 h-3.5 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && <div className="pb-1">{children}</div>}
    </div>
  );
}

export default function UserMenu({ user, rankBadge }: { user: MenuUser; rankBadge?: RankBadge | null }) {
  const ringClass =
    rankBadge?.kind === "admin"
      ? "ring-2 ring-[var(--text-primary)]"
      : rankBadge
      ? "ring-1 ring-[var(--text-primary)]/40"
      : "";
  const [open, setOpen] = useState(false);
  const [section, setSection] = useState<string | null>(null);
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
  const toggle = (key: string) => setSection((s) => (s === key ? null : key));

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
          className="absolute right-0 mt-2 w-56 rounded-xl bg-[var(--bg-surface)] border border-[var(--border)] max-h-[80vh] overflow-y-auto z-50 py-1"
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

          {/* Always-visible essentials */}
          <Link href={`/profile/${user.username ?? user.name}`} className={itemCls}>
            <User className="w-4 h-4" /> โปรไฟล์ของฉัน
          </Link>
          <Link href="/topup" className={itemCls}>
            <Coins className="w-4 h-4" /> เติมเหรียญ
          </Link>
          {/* App/PWA only — offline library. Plain <a> + stopPropagation so iOS
              doesn't cancel the nav by unmounting the link on close. */}
          <a href="/downloads" onClick={(e) => e.stopPropagation()} className={`${itemCls} app-only`}>
            <WifiOff className="w-4 h-4" /> คลังออฟไลน์
          </a>

          {/* Rewards */}
          <Section label="เหรียญ & รางวัล" Icon={Gift} open={section === "rewards"} onToggle={() => toggle("rewards")}>
            <Link href="/earn" className={subCls}>
              <Gift className="w-4 h-4" /> หาเหรียญฟรี
            </Link>
            <Link href="/referral" className={subCls}>
              <Share2 className="w-4 h-4" /> ชวนเพื่อน
            </Link>
            <Link href="/achievements" className={subCls}>
              <Trophy className="w-4 h-4" /> ความสำเร็จ
            </Link>
            <Link href="/leaderboard" className={subCls}>
              <Medal className="w-4 h-4" /> อันดับนักอ่าน
            </Link>
          </Section>

          {/* Creator (staff only) */}
          {isStaff && (
            <Section label="ครีเอเตอร์" Icon={PenTool} open={section === "creator"} onToggle={() => toggle("creator")}>
              <Link href="/dashboard" className={subCls}>
                <LayoutDashboard className="w-4 h-4" /> แดชบอร์ด
              </Link>
              <Link href="/dashboard/new-novel" className={subCls}>
                <PenTool className="w-4 h-4" /> เขียนนิยาย
              </Link>
              {user.role === "TRANSLATOR" && (
                <Link href="/upload" className={subCls}>
                  <Upload className="w-4 h-4" /> อัปโหลดมังงะ
                </Link>
              )}
              <Link href="/dashboard/promote" className={subCls}>
                <Share2 className="w-4 h-4" /> โปรโมตผลงาน
              </Link>
              {isAdmin && (
                <Link href="/admin" className={subCls}>
                  <Shield className="w-4 h-4" /> แอดมิน
                </Link>
              )}
            </Section>
          )}

          {/* General & help */}
          <Section label="ทั่วไป & ช่วยเหลือ" Icon={Settings} open={section === "help"} onToggle={() => toggle("help")}>
            <Link href="/settings" className={subCls}>
              <Settings className="w-4 h-4" /> ตั้งค่า
            </Link>
            <Link href="/contact" className={subCls}>
              <MessageSquare className="w-4 h-4" /> ติดต่อแอดมิน
            </Link>
          </Section>

          <button
            onClick={() => signOut({ callbackUrl: "/" })}
            className={`${itemCls} text-[var(--text-primary)] hover:text-[var(--text-primary)] border-t border-[var(--border)] mt-1`}
          >
            <LogOut className="w-4 h-4" /> ออกจากระบบ
          </button>
        </div>
      )}
    </div>
  );
}
