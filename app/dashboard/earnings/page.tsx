import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import {
  Coins, TrendingUp, Wallet, Clock, ArrowLeft, ArrowRight, BadgeDollarSign,
} from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "รายได้ของฉัน | INKVERSE" };

function StatCard({
  label, value, sub, icon: Icon, color,
}: {
  label: string; value: string; sub?: string;
  icon: React.ElementType; color: string;
}) {
  return (
    <div className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border)] p-5">
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-3 ${color}`}>
        <Icon className="w-4 h-4 text-[var(--text-primary)]" />
      </div>
      <p className="text-2xl font-bold text-[var(--text-primary)]">{value}</p>
      <p className="text-xs text-[var(--text-secondary)] mt-0.5">{label}</p>
      {sub && <p className="text-xs text-[var(--text-primary)] mt-1">{sub}</p>}
    </div>
  );
}

export default async function EarningsPage() {
  const session = await auth();
  const role = (session?.user as { role?: string })?.role;
  if (!session?.user || (role !== "TRANSLATOR" && role !== "ADMIN")) redirect("/");

  const userId = (session.user as { id: string }).id;
  const translator = await prisma.translator.findUnique({ where: { userId } });
  if (!translator) redirect("/apply");

  const [earningsAgg, withdrawnAgg, pendingAgg, recentEarnings, byMangaRaw, withdrawals] =
    await Promise.all([
      prisma.translatorEarning.aggregate({
        where: { translatorId: translator.id },
        _sum: { amount: true, coinsSpent: true },
        _count: true,
      }),
      prisma.withdrawalRequest.aggregate({
        where: { translatorId: translator.id, status: { in: ["PAID"] } },
        _sum: { amount: true },
      }),
      prisma.withdrawalRequest.aggregate({
        where: { translatorId: translator.id, status: { in: ["PENDING", "APPROVED"] } },
        _sum: { amount: true },
      }),
      prisma.translatorEarning.findMany({
        where: { translatorId: translator.id },
        orderBy: { createdAt: "desc" },
        take: 30,
      }),
      prisma.translatorEarning.groupBy({
        by: ["mangaId"],
        where: { translatorId: translator.id },
        _sum: { amount: true, coinsSpent: true },
        _count: true,
        orderBy: { _sum: { amount: "desc" } },
      }),
      prisma.withdrawalRequest.findMany({
        where: { translatorId: translator.id },
        orderBy: { requestedAt: "desc" },
        take: 10,
      }),
    ]);

  const totalEarned = earningsAgg._sum.amount ?? 0;
  const paidOut = withdrawnAgg._sum.amount ?? 0;
  const pending = pendingAgg._sum.amount ?? 0;
  const available = Math.max(0, totalEarned - paidOut - pending);

  // Tips have no mangaId; exclude them from the per-title breakdown.
  const byMangaNonNull = byMangaRaw.filter(
    (b): b is typeof b & { mangaId: string } => b.mangaId !== null
  );
  const mangaIds = byMangaNonNull.map((b) => b.mangaId);
  const mangas = await prisma.manga.findMany({
    where: { id: { in: mangaIds } },
    select: { id: true, title: true, slug: true, coverUrl: true },
  });
  const mangaMap = Object.fromEntries(mangas.map((m) => [m.id, m]));

  const byManga = byMangaNonNull.map((b) => ({
    ...b,
    title: mangaMap[b.mangaId]?.title ?? "ไม่ทราบ",
    slug: mangaMap[b.mangaId]?.slug ?? "",
    coverUrl: mangaMap[b.mangaId]?.coverUrl ?? null,
    totalAmount: b._sum.amount ?? 0,
    totalCoins: b._sum.coinsSpent ?? 0,
  }));

  const statusLabel: Record<string, { label: string; cls: string }> = {
    PENDING:  { label: "รอดำเนินการ", cls: "bg-[var(--bg-card)] text-[var(--text-primary)]" },
    APPROVED: { label: "อนุมัติแล้ว", cls: "bg-[var(--bg-card)] text-[var(--text-secondary)]" },
    PAID:     { label: "โอนแล้ว",     cls: "bg-[var(--bg-card)] text-[var(--text-primary)]" },
    REJECTED: { label: "ถูกปฏิเสธ",   cls: "bg-[var(--bg-card)] text-[var(--text-primary)]" },
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <Link href="/dashboard" className="inline-flex items-center gap-1.5 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] mb-2 transition-colors">
            <ArrowLeft className="w-3.5 h-3.5" /> Dashboard
          </Link>
          <h1 className="font-bebas text-4xl text-[var(--text-primary)] tracking-wider">รายได้ของฉัน</h1>
          <p className="text-xs text-[var(--text-secondary)] mt-0.5">อัตราแบ่งรายได้: นักแปล 80% / แพลตฟอร์ม 20%</p>
        </div>
        {available >= 100 && (
          <Link
            href="/dashboard/withdraw"
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bal-btn text-sm font-semibold hover:opacity-90 transition-colors"
          >
            <Wallet className="w-4 h-4" />
            ถอนเงิน ฿{available.toFixed(0)}
            <ArrowRight className="w-4 h-4" />
          </Link>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard
          label="รายได้รวมทั้งหมด"
          value={`฿${totalEarned.toFixed(2)}`}
          sub={`${earningsAgg._count} ครั้ง`}
          icon={TrendingUp}
          color="bg-[var(--text-primary)]/80"
        />
        <StatCard
          label="ยอดที่ถอนได้"
          value={`฿${available.toFixed(2)}`}
          sub={available >= 100 ? "พร้อมถอน" : `ขั้นต่ำ ฿100`}
          icon={Wallet}
          color="bg-[var(--bg-card)]"
        />
        <StatCard
          label="รอดำเนินการ"
          value={`฿${pending.toFixed(2)}`}
          icon={Clock}
          color="bg-[var(--bg-card)]"
        />
        <StatCard
          label="โอนแล้วทั้งหมด"
          value={`฿${paidOut.toFixed(2)}`}
          icon={BadgeDollarSign}
          color="bg-[var(--bg-card)]"
        />
      </div>

      {/* Earnings by manga */}
      {byManga.length > 0 && (
        <div className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border)] p-5">
          <h2 className="text-sm font-semibold text-[var(--text-primary)] mb-4 flex items-center gap-2">
            <Coins className="w-4 h-4 text-[var(--text-primary)]" />
            รายได้แยกตามผลงาน
          </h2>
          <div className="space-y-3">
            {byManga.map((m) => (
              <div key={m.mangaId} className="flex items-center gap-3">
                {m.coverUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={m.coverUrl} alt="" className="w-9 h-12 object-cover rounded-lg shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-[var(--text-primary)] truncate">{m.title}</p>
                  <p className="text-xs text-[var(--text-secondary)]">{m._count} ครั้งปลดล็อก · {m.totalCoins} coins</p>
                </div>
                <span className="text-sm font-semibold text-[var(--text-primary)] shrink-0">
                  ฿{m.totalAmount.toFixed(2)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent earnings */}
      {recentEarnings.length > 0 && (
        <div className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border)] p-5">
          <h2 className="text-sm font-semibold text-[var(--text-primary)] mb-4 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-[var(--text-primary)]" />
            รายการรายได้ล่าสุด
          </h2>
          <div className="divide-y divide-white/5">
            {recentEarnings.map((e) => (
              <div key={e.id} className="flex items-center justify-between py-2.5 gap-3">
                <div className="min-w-0">
                  <p className="text-xs text-[var(--text-secondary)]">
                    {new Date(e.createdAt).toLocaleDateString("th-TH", {
                      day: "numeric", month: "short", year: "numeric",
                      hour: "2-digit", minute: "2-digit",
                    })}
                  </p>
                  <p className="text-xs text-[var(--text-muted)]">{e.coinsSpent} coins</p>
                </div>
                <span className="text-sm font-semibold text-[var(--text-primary)] shrink-0">+฿{e.amount.toFixed(2)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Withdrawal history */}
      {withdrawals.length > 0 && (
        <div className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border)] p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-[var(--text-primary)] flex items-center gap-2">
              <Wallet className="w-4 h-4 text-[var(--text-primary)]" />
              ประวัติการถอนเงิน
            </h2>
            <Link href="/dashboard/withdraw" className="text-xs text-[var(--text-primary)] hover:underline">
              ขอถอนเงิน →
            </Link>
          </div>
          <div className="divide-y divide-white/5">
            {withdrawals.map((w) => {
              const s = statusLabel[w.status] ?? { label: w.status, cls: "bg-gray-500/20 text-[var(--text-secondary)]" };
              return (
                <div key={w.id} className="flex items-center justify-between py-2.5 gap-3">
                  <div className="min-w-0">
                    <p className="text-sm text-[var(--text-primary)] font-medium">฿{w.amount.toFixed(2)}</p>
                    <p className="text-xs text-[var(--text-secondary)]">
                      {w.paymentMethod === "PROMPTPAY" ? "PromptPay" : `ธนาคาร ${w.bankName ?? ""}`}
                      {" · "}{w.accountNumber}
                    </p>
                    <p className="text-xs text-[var(--text-muted)]">
                      {new Date(w.requestedAt).toLocaleDateString("th-TH")}
                    </p>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${s.cls}`}>
                    {s.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {totalEarned === 0 && (
        <div className="text-center py-16 text-[var(--text-muted)]">
          <Coins className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p className="text-sm">ยังไม่มีรายได้ เพิ่มตอน premium เพื่อเริ่มสร้างรายได้</p>
        </div>
      )}
    </div>
  );
}
