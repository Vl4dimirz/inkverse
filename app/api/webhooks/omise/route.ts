import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ ok: false }, { status: 400 });

  // ── charge.complete → coin top-up ────────────────────────────────────────
  if (body.key === "charge.complete") {
    const charge = body.data as {
      id: string;
      status: string;
      metadata?: { orderId?: string };
    };

    if (charge.status === "successful") {
      const orderId = charge.metadata?.orderId;
      if (orderId) {
        const order = await prisma.coinOrder.findUnique({ where: { id: orderId } });
        if (order && order.status === "PENDING") {
          const totalCoins = order.coins + order.bonus;
          await prisma.$transaction([
            prisma.coinOrder.update({
              where: { id: orderId },
              data: { status: "PAID", paidAt: new Date(), omiseChargeId: charge.id },
            }),
            prisma.user.update({
              where: { id: order.userId },
              data: { coins: { increment: totalCoins } },
            }),
            prisma.coinTransaction.create({
              data: {
                userId: order.userId,
                amount: totalCoins,
                type: "TOPUP",
                description: `เติมเหรียญ ${totalCoins} เหรียญ (฿${order.price.toFixed(0)})`,
                refId: orderId,
              },
            }),
          ]);
        }
      }
    }
    return NextResponse.json({ ok: true });
  }

  // ── transfer.complete / transfer.paid → withdrawal paid ──────────────────
  if (body.key === "transfer.complete" || body.key === "transfer.paid") {
    const transfer = body.data as { id: string; paid: boolean; failure_code?: string };

    const withdrawal = await prisma.withdrawalRequest.findFirst({
      where: { omiseTransferId: transfer.id, status: "PROCESSING" },
    });

    if (withdrawal) {
      await prisma.withdrawalRequest.update({
        where: { id: withdrawal.id },
        data: { status: "PAID", processedAt: new Date() },
      });
    }
    return NextResponse.json({ ok: true });
  }

  // ── transfer.destroy → withdrawal failed ─────────────────────────────────
  if (body.key === "transfer.destroy") {
    const transfer = body.data as { id: string; failure_code?: string };

    const withdrawal = await prisma.withdrawalRequest.findFirst({
      where: { omiseTransferId: transfer.id, status: "PROCESSING" },
    });

    if (withdrawal) {
      await prisma.withdrawalRequest.update({
        where: { id: withdrawal.id },
        data: {
          status: "FAILED",
          processedAt: new Date(),
          adminNote: transfer.failure_code ? `Transfer failed: ${transfer.failure_code}` : "Transfer failed",
        },
      });
    }
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ ok: true });
}
