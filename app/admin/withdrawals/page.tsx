import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { ArrowLeft, Wallet } from "lucide-react";
import WithdrawalsAdmin from "./WithdrawalsAdmin";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "คำขอถอนเงิน | Admin" };

export default async function AdminWithdrawalsPage() {
  const session = await auth();
  if ((session?.user as { role?: string })?.role !== "ADMIN") redirect("/");

  const requests = await prisma.withdrawalRequest.findMany({
    orderBy: [{ status: "asc" }, { requestedAt: "desc" }],
    include: {
      translator: {
        select: {
          penName: true,
          user: { select: { email: true, avatarUrl: true } },
        },
      },
    },
  });

  const NET_RATE = 0.80;
  const pendingRequests = requests.filter((r) => r.status === "PENDING");
  const totalPendingGross = pendingRequests.reduce((s, r) => s + r.amount, 0);
  const totalPendingNet = totalPendingGross * NET_RATE;

  const data = requests.map((r) => ({
    id: r.id,
    amount: r.amount,
    status: r.status,
    paymentMethod: r.paymentMethod,
    accountName: r.accountName,
    accountNumber: r.accountNumber,
    bankName: r.bankName,
    bankCode: r.bankCode,
    adminNote: r.adminNote,
    omiseTransferId: r.omiseTransferId,
    omiseRecipientId: r.omiseRecipientId,
    requestedAt: r.requestedAt.toISOString(),
    processedAt: r.processedAt?.toISOString() ?? null,
    translator: {
      penName: r.translator.penName,
      email: r.translator.user.email,
      avatarUrl: r.translator.user.avatarUrl,
    },
  }));

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <Link href="/admin" className="inline-flex items-center gap-1.5 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] mb-2 transition-colors">
            <ArrowLeft className="w-3.5 h-3.5" /> Admin
          </Link>
          <h1 className="font-bebas text-4xl text-[var(--text-primary)] tracking-wider flex items-center gap-3">
            <Wallet className="w-7 h-7 text-[var(--text-primary)]" />
            คำขอถอนเงิน
          </h1>
        </div>
        {totalPendingGross > 0 && (
          <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl px-4 py-3 text-center">
            <p className="text-2xl font-bold text-yellow-400">฿{totalPendingNet.toFixed(2)}</p>
            <p className="text-xs text-yellow-500/80">ต้องโอนจริง ({pendingRequests.length} รายการ)</p>
            <p className="text-xs text-yellow-700 mt-0.5">ขอ ฿{totalPendingGross.toFixed(2)} · หัก 20%</p>
          </div>
        )}
      </div>

      <WithdrawalsAdmin requests={data} />
    </div>
  );
}
