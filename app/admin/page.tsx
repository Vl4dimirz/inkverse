import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Users, BookOpen, MessageSquare, TrendingUp, Wallet, ShoppingBag, Coins, Eye, UserCheck, FileText } from "lucide-react";
import Link from "next/link";
import RecalculateButton from "./RecalculateButton";
import ToolkitBannerDownloads from "@/components/ui/ToolkitBannerDownloads";

export const metadata = { title: "แผงผู้ดูแลระบบ" };

export default async function AdminPage() {
  const session = await auth();

  if (!session?.user || (session.user as { role?: string }).role !== "ADMIN") {
    redirect("/");
  }

  const today = new Date().toISOString().slice(0, 10);
  const [
    userCount, mangaCount, chapterCount, commentCount, pendingApps, openContacts, pendingVerifs,
    revenue, payingUsers, trafficToday, trafficTotal, traffic7, recentMangas, pendingServiceOrders,
  ] = await Promise.all([
      // Real users only — exclude seed/test accounts (rating bots etc.).
      prisma.user.count({
        where: { NOT: { email: { endsWith: "@seed.inkverse.local" } } },
      }),
      prisma.manga.count(),
      prisma.chapter.count(),
      prisma.comment.count(),
      prisma.translatorApplication.count({ where: { status: "PENDING" } }),
      prisma.contactMessage.count({ where: { status: "OPEN" } }),
      prisma.verificationRequest.count({ where: { status: "PENDING" } }),
      prisma.coinOrder.aggregate({ where: { status: "PAID" }, _sum: { price: true, coins: true, bonus: true }, _count: true }),
      prisma.coinOrder.groupBy({ by: ["userId"], where: { status: "PAID" } }).then((r) => r.length),
      prisma.dailyStat.findUnique({ where: { day: today } }),
      prisma.dailyStat.aggregate({ _sum: { pageViews: true, visitors: true } }),
      prisma.dailyStat.findMany({ orderBy: { day: "desc" }, take: 7 }),
      prisma.manga.findMany({
        take: 10,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          title: true,
          slug: true,
          status: true,
          type: true,
          totalViews: true,
          createdAt: true,
          _count: { select: { chapters: true } },
        },
      }),
      // Service orders waiting for the owner to deliver.
      prisma.serviceOrder.count({ where: { status: "IN_PROGRESS" } }),
    ]);

  const totalRevenue = revenue._sum.price ?? 0;
  const paidOrders = revenue._count ?? 0;
  const coinsSold = (revenue._sum.coins ?? 0) + (revenue._sum.bonus ?? 0);
  const pvToday = trafficToday?.pageViews ?? 0;
  const visToday = trafficToday?.visitors ?? 0;
  const pvTotal = trafficTotal._sum.pageViews ?? 0;
  const visTotal = trafficTotal._sum.visitors ?? 0;
  const maxDay = Math.max(1, ...traffic7.map((d) => d.visitors));

  const stats = [
    { label: "ผู้ใช้ทั้งหมด", value: userCount, icon: Users, color: "text-[var(--text-secondary)]" },
    { label: "มังงะทั้งหมด", value: mangaCount, icon: BookOpen, color: "text-[var(--text-primary)]" },
    { label: "ตอนทั้งหมด", value: chapterCount, icon: TrendingUp, color: "text-[var(--text-primary)]" },
    { label: "ความคิดเห็น", value: commentCount, icon: MessageSquare, color: "text-[var(--text-primary)]" },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      <h1 className="font-bebas text-4xl text-[var(--text-primary)] tracking-wider mb-8">
        แผงผู้ดูแลระบบ
      </h1>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
        {stats.map(({ label, value, icon: Icon, color }) => (
          <div
            key={label}
            className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border)] p-5"
          >
            <Icon className={`w-6 h-6 ${color} mb-3`} />
            <p className="text-3xl font-bold text-[var(--text-primary)] mb-0.5">
              {value.toLocaleString()}
            </p>
            <p className="text-sm text-[var(--text-secondary)]">{label}</p>
          </div>
        ))}
      </div>

      {/* Revenue */}
      <h2 className="font-bebas text-2xl text-[var(--text-primary)] tracking-[0.18em] uppercase flex items-center gap-3 mb-4">
        <span className="w-6 h-px bg-[var(--text-primary)]" /> รายได้ &amp; ยอดขาย
      </h2>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
        {[
          { label: "รายได้รวม", value: `฿${totalRevenue.toLocaleString()}`, icon: Wallet },
          { label: "ออเดอร์สำเร็จ", value: paidOrders.toLocaleString(), icon: ShoppingBag },
          { label: "ผู้ซื้อ (คน)", value: payingUsers.toLocaleString(), icon: UserCheck },
          { label: "เหรียญที่ขาย", value: coinsSold.toLocaleString(), icon: Coins },
        ].map(({ label, value, icon: Icon }) => (
          <div key={label} className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--text-primary)]/25 p-5">
            <Icon className="w-6 h-6 text-[var(--text-primary)] mb-3" />
            <p className="text-3xl font-bold text-[var(--text-primary)] mb-0.5">{value}</p>
            <p className="text-sm text-[var(--text-secondary)]">{label}</p>
          </div>
        ))}
      </div>

      {/* Traffic */}
      <h2 className="font-bebas text-2xl text-[var(--text-primary)] tracking-[0.18em] uppercase flex items-center gap-3 mb-4">
        <span className="w-6 h-px bg-[var(--text-primary)]" /> ยอดเข้าชม <span className="text-[10px] text-[var(--text-muted)] normal-case tracking-normal">(ไม่นับแอดมิน)</span>
        <Link href="/admin/analytics" className="ml-auto text-xs normal-case tracking-normal font-normal text-[var(--text-secondary)] hover:text-[var(--text-primary)] inline-flex items-center gap-1">
          ภาพรวม Funnel →
        </Link>
      </h2>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        {[
          { label: "ผู้เข้าชมวันนี้", value: visToday.toLocaleString(), icon: Eye },
          { label: "เพจวิววันนี้", value: pvToday.toLocaleString(), icon: TrendingUp },
          { label: "ผู้เข้าชมรวม", value: visTotal.toLocaleString(), icon: Users },
          { label: "เพจวิวรวม", value: pvTotal.toLocaleString(), icon: Eye },
        ].map(({ label, value, icon: Icon }) => (
          <div key={label} className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border)] p-5">
            <Icon className="w-6 h-6 text-[var(--text-primary)] mb-3" />
            <p className="text-3xl font-bold text-[var(--text-primary)] mb-0.5">{value}</p>
            <p className="text-sm text-[var(--text-secondary)]">{label}</p>
          </div>
        ))}
      </div>

      {/* 7-day traffic bars */}
      {traffic7.length > 0 && (
        <div className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border)] p-5 mb-10">
          <p className="text-sm font-semibold text-[var(--text-primary)] mb-3">ผู้เข้าชม 7 วันล่าสุด</p>
          <div className="space-y-2">
            {[...traffic7].reverse().map((d) => (
              <div key={d.day} className="flex items-center gap-3 text-xs">
                <span className="w-20 shrink-0 text-[var(--text-secondary)]">{d.day.slice(5)}</span>
                <div className="flex-1 h-4 bg-[var(--bg-card)] overflow-hidden">
                  <div className="h-full bg-[var(--text-primary)]" style={{ width: `${Math.round((d.visitors / maxDay) * 100)}%` }} />
                </div>
                <span className="w-24 shrink-0 text-right text-[var(--text-secondary)]">{d.visitors.toLocaleString()} คน · {d.pageViews.toLocaleString()} วิว</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Marketing assets */}
      <h2 className="font-bebas text-2xl text-[var(--text-primary)] tracking-[0.18em] uppercase flex items-center gap-3 mb-4">
        <span className="w-6 h-px bg-[var(--text-primary)]" /> เครื่องมือการตลาด
      </h2>
      <ToolkitBannerDownloads />

      {/* Quick actions */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-10">
        <Link
          href="/upload"
          className="py-3 px-5 rounded-xl bal-btn text-sm font-medium text-center hover:opacity-90 transition-colors"
        >
          อัปโหลดมังงะใหม่
        </Link>
        <Link
          href="/admin/applications"
          className="relative py-3 px-5 rounded-xl bg-gradient-to-r from-[var(--bg-card)] to-[var(--bg-surface)] text-[var(--text-primary)] text-sm font-medium text-center hover:opacity-90 transition-colors"
        >
          ใบสมัครนักแปล
          {pendingApps > 0 && (
            <span className="absolute -top-2 -right-2 min-w-5 h-5 px-1.5 rounded-full bg-[var(--text-primary)] text-[var(--bg-primary)] text-xs font-bold flex items-center justify-center ">
              {pendingApps}
            </span>
          )}
        </Link>
        <Link
          href="/admin/withdrawals"
          className="py-3 px-5 rounded-xl bg-gradient-to-r from-[var(--bg-card)] to-[var(--bg-surface)] text-[var(--text-primary)] text-sm font-medium text-center hover:opacity-90 transition-colors"
        >
          คำขอถอนเงิน
        </Link>
        <Link
          href="/admin/coin-packages"
          className="py-3 px-5 rounded-xl bg-gradient-to-r from-[var(--bg-card)] to-[var(--bg-surface)] text-[var(--text-primary)] text-sm font-medium text-center hover:opacity-90 transition-colors"
        >
          จัดการแพ็กเหรียญ
        </Link>
        <Link
          href="/admin/contact"
          className="relative py-3 px-5 rounded-xl bg-gradient-to-r from-[var(--bg-card)] to-[var(--bg-surface)] text-[var(--text-primary)] text-sm font-medium text-center hover:opacity-90 transition-colors"
        >
          กล่องข้อความติดต่อ
          {openContacts > 0 && (
            <span className="absolute -top-2 -right-2 min-w-5 h-5 px-1.5 rounded-full bg-[var(--text-primary)] text-[var(--bg-primary)] text-xs font-bold flex items-center justify-center ">
              {openContacts}
            </span>
          )}
        </Link>
        <Link
          href="/admin/verifications"
          className="relative py-3 px-5 rounded-xl bg-gradient-to-r from-[var(--bg-card)] to-[var(--bg-surface)] text-[var(--text-primary)] text-sm font-medium text-center hover:opacity-90 transition-colors"
        >
          คำขอยืนยันตัวตน
          {pendingVerifs > 0 && (
            <span className="absolute -top-2 -right-2 min-w-5 h-5 px-1.5 rounded-full bg-[var(--text-primary)] text-[var(--bg-primary)] text-xs font-bold flex items-center justify-center ">
              {pendingVerifs}
            </span>
          )}
        </Link>
        <Link
          href="/dashboard/services"
          className="relative py-3 px-5 rounded-xl bg-gradient-to-r from-[var(--bg-card)] to-[var(--bg-surface)] text-[var(--text-primary)] text-sm font-medium text-center hover:opacity-90 transition-colors inline-flex items-center justify-center gap-2"
        >
          <FileText className="w-4 h-4" /> ออเดอร์บริการ
          {pendingServiceOrders > 0 && (
            <span className="absolute -top-2 -right-2 min-w-5 h-5 px-1.5 rounded-full bg-[var(--text-primary)] text-[var(--bg-primary)] text-xs font-bold flex items-center justify-center ">
              {pendingServiceOrders}
            </span>
          )}
        </Link>
        <RecalculateButton />
      </div>

      {/* Recent manga table */}
      <div className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border)] overflow-hidden">
        <div className="p-4 border-b border-[var(--border)]">
          <h2 className="font-semibold text-[var(--text-primary)]">มังงะล่าสุด</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-[var(--text-secondary)] border-b border-[var(--border)]">
                <th className="text-left px-4 py-3 font-medium">ชื่อ</th>
                <th className="text-left px-4 py-3 font-medium">ประเภท</th>
                <th className="text-left px-4 py-3 font-medium">สถานะ</th>
                <th className="text-left px-4 py-3 font-medium">ตอน</th>
                <th className="text-left px-4 py-3 font-medium">ยอดชม</th>
                <th className="text-left px-4 py-3 font-medium">วันที่</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {recentMangas.map((manga: (typeof recentMangas)[number]) => (
                <tr key={manga.id} className="hover:bg-white/5 transition-colors">
                  <td className="px-4 py-3">
                    <Link
                      href={`/content/${manga.slug}`}
                      className="text-[var(--text-primary)] hover:text-[var(--text-primary)] transition-colors font-medium"
                    >
                      {manga.title}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-[var(--text-secondary)]">{manga.type}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        manga.status === "ONGOING"
                          ? "bg-[var(--bg-card)] text-[var(--text-primary)]"
                          : manga.status === "COMPLETED"
                          ? "bg-[var(--bg-card)] text-[var(--text-secondary)]"
                          : "bg-[var(--bg-card)] text-[var(--text-primary)]"
                      }`}
                    >
                      {manga.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-[var(--text-secondary)]">
                    {manga._count.chapters}
                  </td>
                  <td className="px-4 py-3 text-[var(--text-secondary)]">
                    {manga.totalViews.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-[var(--text-secondary)]">
                    {new Date(manga.createdAt).toLocaleDateString("th-TH")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
