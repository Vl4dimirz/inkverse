import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { Settings } from "lucide-react";
import SignOutButton from "@/components/ui/SignOutButton";
import SettingsTabs from "@/components/ui/SettingsTabs";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "ตั้งค่าบัญชี — INKVERSE" };

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user) redirect("/auth/signin?callbackUrl=/settings");

  const userId = (session.user as { id: string }).id;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      username: true,
      name: true,
      bio: true,
      website: true,
      location: true,
      phone: true,
      recoveryEmail: true,
      avatarUrl: true,
      coverUrl: true,
      twoFactorEnabled: true,
      verifiedAt: true,
    },
  });

  if (!user) redirect("/auth/signin");

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Settings className="w-5 h-5 text-[var(--text-primary)]" />
          <h1 className="font-bebas text-3xl text-[var(--text-primary)] tracking-wider">
            ตั้งค่าบัญชี
          </h1>
        </div>
        {user.verifiedAt && (
          <span className="text-[10px] uppercase tracking-widest border border-[var(--text-primary)] text-[var(--text-primary)] px-2 py-1">
            ยืนยันแล้ว
          </span>
        )}
      </div>

      {/* Tabbed settings */}
      <SettingsTabs user={user} />

      {/* Footer quick links */}
      <div className="pt-4 border-t border-[var(--border)] flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/profile/${user.username}`}
            className="px-4 py-2 border border-[var(--border)] text-sm text-[var(--text-primary)] hover:border-[var(--text-primary)]/60 transition-colors"
          >
            ดูโปรไฟล์
          </Link>
          <Link
            href="/topup"
            className="px-4 py-2 border border-[var(--border)] text-sm text-[var(--text-primary)] hover:border-[var(--text-primary)]/60 transition-colors"
          >
            เติมเหรียญ
          </Link>
        </div>
        <SignOutButton />
      </div>

      <p className="text-xs text-[var(--text-muted)]">
        สลับโหมดสว่าง/มืดได้ที่ปุ่มบนแถบเมนูด้านบน
      </p>
    </div>
  );
}
