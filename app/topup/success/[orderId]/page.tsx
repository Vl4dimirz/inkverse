import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { CheckCircle2, Coins, Home, History } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "เติมเหรียญสำเร็จ | INKVERSE" };

export default async function TopupSuccessPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/auth/signin");

  const { orderId } = await params;
  const userId = (session.user as { id: string }).id;

  const order = await prisma.coinOrder.findUnique({
    where: { id: orderId },
    include: { user: { select: { coins: true } } },
  });

  if (!order || order.userId !== userId) notFound();
  if (order.status === "PENDING") redirect(`/topup/checkout/${orderId}`);
  if (order.status !== "PAID") redirect("/topup");

  const pkg = await prisma.coinPackage.findUnique({ where: { id: order.packageId } });
  const total = order.coins + order.bonus;

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4">
      <div className="w-full max-w-md text-center space-y-6">
        {/* Icon */}
        <div className="flex justify-center">
          <div className="w-20 h-20 rounded-full bg-green-500/10 border border-green-500/20 flex items-center justify-center">
            <CheckCircle2 className="w-10 h-10 text-green-400" />
          </div>
        </div>

        {/* Title */}
        <div>
          <h1 className="font-bebas text-4xl text-[var(--text-primary)] tracking-wider mb-2">
            เติมเหรียญสำเร็จ!
          </h1>
          <p className="text-[var(--text-secondary)] text-sm">
            รายการ #{orderId.slice(-8).toUpperCase()} ได้รับการยืนยันแล้ว
          </p>
        </div>

        {/* Coins received */}
        <div className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border)] p-6">
          <p className="text-xs text-[var(--text-secondary)] uppercase tracking-widest mb-3">
            {pkg?.name ?? "แพ็กเกจเหรียญ"}
          </p>
          <div className="flex items-center justify-center gap-3 mb-3">
            <Coins className="w-10 h-10 text-yellow-400" />
            <span className="font-bebas text-5xl text-yellow-400 tracking-wider">
              +{total.toLocaleString()}
            </span>
          </div>
          {order.bonus > 0 && (
            <p className="text-xs text-green-400 mb-3">
              รวมโบนัส {order.bonus.toLocaleString()} เหรียญ
            </p>
          )}
          <div className="border-t border-[var(--border)] pt-3 flex items-center justify-between text-sm">
            <span className="text-[var(--text-secondary)]">ยอดเหรียญปัจจุบัน</span>
            <span className="flex items-center gap-1.5 text-[var(--text-primary)] font-semibold">
              <Coins className="w-4 h-4 text-yellow-400" />
              {order.user.coins.toLocaleString()} เหรียญ
            </span>
          </div>
        </div>

        {/* CTA buttons */}
        <div className="flex flex-col sm:flex-row gap-3">
          <Link
            href="/"
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-[var(--text-primary)] text-[var(--bg-primary)] font-semibold text-sm hover:opacity-90 transition-opacity"
          >
            <Home className="w-4 h-4" />
            กลับสู่หน้าหลัก
          </Link>
          <Link
            href="/topup"
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-[var(--bg-surface)] border border-[var(--border)] text-[var(--text-primary)] font-semibold text-sm hover:border-white/25 transition-all"
          >
            <History className="w-4 h-4" />
            ดูประวัติเหรียญ
          </Link>
        </div>
      </div>
    </div>
  );
}
