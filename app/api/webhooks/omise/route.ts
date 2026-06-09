import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ ok: false }, { status: 400 });

  // Only handle charge.complete events
  if (body.key !== "charge.complete") return NextResponse.json({ ok: true });

  const charge = body.data as {
    id: string;
    status: string;
    metadata?: { orderId?: string };
  };

  if (charge.status !== "successful") return NextResponse.json({ ok: true });

  const orderId = charge.metadata?.orderId;
  if (!orderId) return NextResponse.json({ ok: true });

  const order = await prisma.coinOrder.findUnique({ where: { id: orderId } });
  if (!order || order.status !== "PENDING") return NextResponse.json({ ok: true });

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

  return NextResponse.json({ ok: true });
}
