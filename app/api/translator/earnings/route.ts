import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  const role = (session?.user as { role?: string })?.role;
  if (!session?.user || (role !== "TRANSLATOR" && role !== "ADMIN")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = (session.user as { id: string }).id;

  const translator = await prisma.translator.findUnique({ where: { userId } });
  if (!translator) return NextResponse.json({ error: "Not a translator" }, { status: 403 });

  const [earningsAgg, withdrawn, pendingAgg, recentEarnings, byManga] = await Promise.all([
    prisma.translatorEarning.aggregate({
      where: { translatorId: translator.id },
      _sum: { amount: true, coinsSpent: true },
      _count: true,
    }),
    prisma.withdrawalRequest.aggregate({
      where: { translatorId: translator.id, status: { not: "REJECTED" } },
      _sum: { amount: true },
    }),
    prisma.withdrawalRequest.aggregate({
      where: { translatorId: translator.id, status: { in: ["PENDING", "APPROVED"] } },
      _sum: { amount: true },
    }),
    prisma.translatorEarning.findMany({
      where: { translatorId: translator.id },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true, coinsSpent: true, amount: true, createdAt: true,
        chapterId: true, mangaId: true,
      },
    }),
    prisma.translatorEarning.groupBy({
      by: ["mangaId"],
      where: { translatorId: translator.id },
      _sum: { amount: true, coinsSpent: true },
      _count: true,
    }),
  ]);

  const totalEarned = earningsAgg._sum.amount ?? 0;
  const totalWithdrawn = withdrawn._sum.amount ?? 0;
  const availableBalance = parseFloat((totalEarned - totalWithdrawn).toFixed(2));
  const pendingWithdrawal = pendingAgg._sum.amount ?? 0;

  // Resolve manga titles
  const mangaIds = byManga.map((b) => b.mangaId);
  const mangas = await prisma.manga.findMany({
    where: { id: { in: mangaIds } },
    select: { id: true, title: true, slug: true, coverUrl: true },
  });
  const mangaMap = Object.fromEntries(mangas.map((m) => [m.id, m]));

  const earningsByManga = byManga
    .map((b) => ({
      mangaId: b.mangaId,
      title: mangaMap[b.mangaId]?.title ?? "ไม่ทราบ",
      slug: mangaMap[b.mangaId]?.slug ?? "",
      coverUrl: mangaMap[b.mangaId]?.coverUrl ?? null,
      totalAmount: b._sum.amount ?? 0,
      totalCoins: b._sum.coinsSpent ?? 0,
      unlockCount: b._count,
    }))
    .sort((a, b) => b.totalAmount - a.totalAmount);

  return NextResponse.json({
    totalEarned,
    availableBalance,
    pendingWithdrawal,
    totalUnlocks: earningsAgg._count,
    totalCoins: earningsAgg._sum.coinsSpent ?? 0,
    recentEarnings: recentEarnings.map((e) => ({
      ...e,
      createdAt: e.createdAt.toISOString(),
    })),
    earningsByManga,
  });
}
