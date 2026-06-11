"use client";

import { useState } from "react";
import Link from "next/link";
import { Search, Menu, X, LogIn } from "lucide-react";
import Logo from "./Logo";
import CoinBadge from "./CoinBadge";
import NotificationBell from "./NotificationBell";
import ThemeToggle from "./ThemeToggle";
import SearchBox from "./SearchBox";
import UserMenu from "./UserMenu";
import type { RankBadge } from "@/lib/ranks";
import clsx from "clsx";

interface NavbarProps {
  user?: {
    name?: string | null;
    username?: string | null;
    email?: string | null;
    image?: string | null;
    role?: string;
  } | null;
  userCoins?: number;
  rankBadge?: RankBadge | null;
}

const navLinks = [
  { href: "/manga", label: "เรื่องทั้งหมด" },
  { href: "/manga?type=MANGA", label: "มังงะ" },
  { href: "/manga?type=MANHWA", label: "มังฮวา" },
  { href: "/manga?type=MANHUA", label: "มังฮัว" },
  { href: "/manga?type=NOVEL", label: "นิยาย" },
  { href: "/apply?as=translator", label: "สมัครนักแปล" },
  { href: "/apply?as=writer", label: "สมัครนักเขียน" },
];

export default function Navbar({ user, userCoins = 0, rankBadge = null }: NavbarProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  return (
    <nav className="sticky top-0 z-50 bg-[var(--bg-primary)]/95 backdrop-blur-md border-b border-[var(--border)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
        {/* Logo */}
        <Logo size="md" />

        {/* Desktop nav */}
        <div className="hidden lg:flex items-center gap-7">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-[11px] uppercase tracking-[0.18em] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
            >
              {link.label}
            </Link>
          ))}
        </div>

        {/* Search + actions */}
        <div className="flex items-center gap-2">
          <ThemeToggle />
          {/* Desktop search with live suggestions */}
          <SearchBox className="hidden md:block" />

          {/* Mobile search toggle */}
          <button
            className="md:hidden p-2 rounded-lg hover:bg-white/10 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
            onClick={() => setSearchOpen(!searchOpen)}
          >
            <Search className="w-5 h-5" />
          </button>

          {user ? (
            <>
              <CoinBadge initialCoins={userCoins} />
              <NotificationBell />
              <UserMenu user={user} rankBadge={rankBadge} />
            </>
          ) : (
            <Link
              href="/auth/signin"
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bal-btn text-sm font-medium hover:opacity-90 transition-colors"
            >
              <LogIn className="w-4 h-4" />
              เข้าสู่ระบบ
            </Link>
          )}

          {/* Mobile menu */}
          <button
            className="lg:hidden p-2 rounded-lg hover:bg-white/10 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
            onClick={() => setMenuOpen(!menuOpen)}
          >
            {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile search bar */}
      {searchOpen && (
        <div className="md:hidden px-4 pb-3">
          <SearchBox autoFocus onNavigate={() => setSearchOpen(false)} />
        </div>
      )}

      {/* Mobile nav menu */}
      {menuOpen && (
        <div className="lg:hidden border-t border-[var(--border)] bg-[var(--bg-primary)]">
          <div className="px-4 py-3 flex flex-col gap-1">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMenuOpen(false)}
                className="px-3 py-2.5 rounded-lg text-sm text-[var(--text-primary)] hover:text-[var(--text-primary)] hover:bg-white/5 transition-colors"
              >
                {link.label}
              </Link>
            ))}
            {user && (user.role === "TRANSLATOR" || user.role === "ADMIN") && (
              <>
                <Link
                  href="/dashboard/new-novel"
                  onClick={() => setMenuOpen(false)}
                  className="px-3 py-2.5 rounded-lg text-sm bal-btn text-center font-semibold"
                >
                  เขียนนิยาย
                </Link>
                <Link
                  href="/dashboard"
                  onClick={() => setMenuOpen(false)}
                  className="px-3 py-2.5 rounded-lg text-sm text-[var(--text-primary)] hover:bg-white/5 transition-colors font-medium"
                >
                  Creator Dashboard
                </Link>
                <Link
                  href={user.role === "ADMIN" ? "/admin" : "/upload"}
                  onClick={() => setMenuOpen(false)}
                  className="px-3 py-2.5 rounded-lg text-sm text-[var(--text-primary)] hover:bg-white/5 transition-colors font-medium"
                >
                  {user.role === "ADMIN" ? "แอดมิน" : "อัปโหลด"}
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}
