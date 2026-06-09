import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if ((session?.user as { role?: string })?.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const requests = await prisma.withdrawalRequest.findMany({
    orderBy: { requestedAt: "desc" },
    include: {
      translator: {
        select: {
          penName: true,
          user: { select: { email: true, avatarUrl: true } },
        },
      },
    },
  });

  return NextResponse.json(
    requests.map((r) => ({
      id: r.id,
      amount: r.amount,
      status: r.status,
      paymentMethod: r.paymentMethod,
      accountName: r.accountName,
      accountNumber: r.accountNumber,
      bankName: r.bankName,
      adminNote: r.adminNote,
      requestedAt: r.requestedAt.toISOString(),
      processedAt: r.processedAt?.toISOString() ?? null,
      translator: {
        penName: r.translator.penName,
        email: r.translator.user.email,
        avatarUrl: r.translator.user.avatarUrl,
      },
    }))
  );
}
