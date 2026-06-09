import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import WithdrawClient from "./WithdrawClient";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "ถอนเงิน | INKVERSE" };

export default async function WithdrawPage() {
  const session = await auth();
  const role = (session?.user as { role?: string })?.role;
  if (!session?.user || (role !== "TRANSLATOR" && role !== "ADMIN")) redirect("/");

  const userId = (session.user as { id: string }).id;
  const translator = await prisma.translator.findUnique({ where: { userId } });
  if (!translator) redirect("/apply");

  const [earningsAgg, withdrawnAgg, history] = await Promise.all([
    prisma.translatorEarning.aggregate({
      where: { translatorId: translator.id },
      _sum: { amount: true },
    }),
    prisma.withdrawalRequest.aggregate({
      where: { translatorId: translator.id, status: { notIn: ["REJECTED", "FAILED"] } },
      _sum: { amount: true },
    }),
    prisma.withdrawalRequest.findMany({
      where: { translatorId: translator.id },
      orderBy: { requestedAt: "desc" },
    }),
  ]);

  const available = Math.max(
    0,
    parseFloat(((earningsAgg._sum.amount ?? 0) - (withdrawnAgg._sum.amount ?? 0)).toFixed(2))
  );

  return (
    <div className="max-w-xl mx-auto px-4 sm:px-6 py-8">
      <Link href="/dashboard/earnings" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-white mb-6 transition-colors">
        <ArrowLeft className="w-3.5 h-3.5" /> รายได้ของฉัน
      </Link>
      <h1 className="font-bebas text-4xl text-white tracking-wider mb-6">ถอนเงิน</h1>
      <WithdrawClient
        availableBalance={available}
        history={history.map((w) => ({
          ...w,
          requestedAt: w.requestedAt.toISOString(),
          processedAt: w.processedAt?.toISOString() ?? null,
        }))}
      />
    </div>
  );
}
