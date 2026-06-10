import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { Settings, User, Mail, Shield, Calendar } from "lucide-react";
import SignOutButton from "@/components/ui/SignOutButton";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "ตั้งค่าบัญชี" };

const roleLabel: Record<string, string> = {
  READER: "นักอ่าน",
  TRANSLATOR: "นักแปล",
  ADMIN: "ผู้ดูแลระบบ",
};

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user) redirect("/auth/signin?callbackUrl=/settings");

  const userId = (session.user as { id: string }).id;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { username: true, email: true, role: true, createdAt: true },
  });
  if (!user) redirect("/auth/signin");

  const rows = [
    { icon: User, label: "ชื่อผู้ใช้", value: user.username },
    { icon: Mail, label: "อีเมล", value: user.email },
    { icon: Shield, label: "บทบาท", value: roleLabel[user.role] ?? user.role },
    {
      icon: Calendar,
      label: "เข้าร่วมเมื่อ",
      value: new Date(user.createdAt).toLocaleDateString("th-TH", { year: "numeric", month: "long", day: "numeric" }),
    },
  ];

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      <div className="flex items-center gap-3">
        <Settings className="w-6 h-6 text-[#ff6b2b]" />
        <h1 className="font-bebas text-3xl text-[var(--text-primary)] tracking-wider">ตั้งค่าบัญชี</h1>
      </div>

      {/* Account info */}
      <div className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border)] divide-y divide-[var(--border)]">
        {rows.map(({ icon: Icon, label, value }) => (
          <div key={label} className="flex items-center gap-3 px-4 py-3">
            <Icon className="w-4 h-4 text-[var(--text-secondary)] shrink-0" />
            <span className="text-sm text-[var(--text-secondary)] w-28 shrink-0">{label}</span>
            <span className="text-sm text-[var(--text-primary)] truncate">{value}</span>
          </div>
        ))}
      </div>

      {/* Theme hint */}
      <p className="text-xs text-[var(--text-secondary)]">
        สลับโหมดสว่าง/มืดได้ที่ปุ่ม 🌙/☀️ บนแถบเมนูด้านบน
      </p>

      {/* Quick links */}
      <div className="flex flex-wrap gap-2">
        <Link href={`/profile/${user.username}`} className="px-4 py-2 rounded-xl bg-[var(--bg-card)] border border-[var(--border)] text-sm text-[var(--text-primary)] hover:border-[#ff2d55]/40 transition-colors">
          ดูโปรไฟล์ของฉัน
        </Link>
        <Link href="/topup" className="px-4 py-2 rounded-xl bg-[var(--bg-card)] border border-[var(--border)] text-sm text-[var(--text-primary)] hover:border-[#ff2d55]/40 transition-colors">
          เติมเหรียญ
        </Link>
      </div>

      {/* Account actions */}
      <div className="pt-2 border-t border-[var(--border)]">
        <SignOutButton />
      </div>
    </div>
  );
}
