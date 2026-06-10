import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Users, BookOpen, MessageSquare, TrendingUp } from "lucide-react";
import Link from "next/link";
import RecalculateButton from "./RecalculateButton";

export const metadata = { title: "แผงผู้ดูแลระบบ" };

export default async function AdminPage() {
  const session = await auth();

  if (!session?.user || (session.user as { role?: string }).role !== "ADMIN") {
    redirect("/");
  }

  const [userCount, mangaCount, chapterCount, commentCount, pendingApps, recentMangas] =
    await Promise.all([
      prisma.user.count(),
      prisma.manga.count(),
      prisma.chapter.count(),
      prisma.comment.count(),
      prisma.translatorApplication.count({ where: { status: "PENDING" } }),
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
    ]);

  const stats = [
    { label: "ผู้ใช้ทั้งหมด", value: userCount, icon: Users, color: "text-blue-400" },
    { label: "มังงะทั้งหมด", value: mangaCount, icon: BookOpen, color: "text-[#ff2d55]" },
    { label: "ตอนทั้งหมด", value: chapterCount, icon: TrendingUp, color: "text-[#ff6b2b]" },
    { label: "ความคิดเห็น", value: commentCount, icon: MessageSquare, color: "text-green-400" },
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

      {/* Quick actions */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-10">
        <Link
          href="/upload"
          className="py-3 px-5 rounded-xl bg-gradient-to-r from-[#ff2d55] to-[#ff6b2b] text-[var(--text-primary)] text-sm font-medium text-center hover:opacity-90 transition-opacity"
        >
          อัปโหลดมังงะใหม่
        </Link>
        <Link
          href="/admin/applications"
          className="relative py-3 px-5 rounded-xl bg-gradient-to-r from-yellow-500 to-orange-500 text-[var(--text-primary)] text-sm font-medium text-center hover:opacity-90 transition-opacity"
        >
          ใบสมัครนักแปล
          {pendingApps > 0 && (
            <span className="absolute -top-2 -right-2 min-w-5 h-5 px-1.5 rounded-full bg-red-600 text-white text-xs font-bold flex items-center justify-center shadow-lg">
              {pendingApps}
            </span>
          )}
        </Link>
        <Link
          href="/admin/withdrawals"
          className="py-3 px-5 rounded-xl bg-gradient-to-r from-green-500 to-teal-500 text-[var(--text-primary)] text-sm font-medium text-center hover:opacity-90 transition-opacity"
        >
          คำขอถอนเงิน
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
                      className="text-[var(--text-primary)] hover:text-[#ff6b2b] transition-colors font-medium"
                    >
                      {manga.title}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-[var(--text-secondary)]">{manga.type}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        manga.status === "ONGOING"
                          ? "bg-green-500/20 text-green-400"
                          : manga.status === "COMPLETED"
                          ? "bg-blue-500/20 text-blue-400"
                          : "bg-yellow-500/20 text-yellow-400"
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
