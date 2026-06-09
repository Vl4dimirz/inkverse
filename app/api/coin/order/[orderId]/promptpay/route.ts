import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const omise = process.env.OMISE_SECRET_KEY
  ? require("omise")({ secretKey: process.env.OMISE_SECRET_KEY, omiseVersion: "2019-05-29" })
  : null;

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  const session = await auth();
  if (!session?.user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { orderId } = await params;
  const userId = (session.user as { id: string }).id;
  const order = await prisma.coinOrder.findUnique({ where: { id: orderId } });

  if (!order || order.userId !== userId)
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  if (order.status !== "PENDING")
    return NextResponse.json({ error: "Order already processed" }, { status: 409 });

  // Sandbox — no Omise keys
  if (!omise) {
    return NextResponse.json({ qrUrl: null, chargeId: null, sandbox: true });
  }

  // Create Omise PromptPay source + charge
  let qrUrl: string | null = null;
  let chargeId: string | null = null;
  try {
    const source = await omise.sources.create({
      amount: Math.round(order.price * 100),
      currency: "thb",
      type: "promptpay",
    });

    const charge = await omise.charges.create({
      amount: Math.round(order.price * 100),
      currency: "thb",
      source: source.id,
      description: `INKVERSE ${order.coins + order.bonus} coins`,
      return_uri: `${process.env.NEXTAUTH_URL}/topup/success/${orderId}`,
      metadata: { orderId },
    });

    chargeId = charge.id as string;
    qrUrl =
      (charge.source?.scannable_code?.image?.download_uri as string) ?? null;

    await prisma.coinOrder.update({
      where: { id: orderId },
      data: { method: "PROMPTPAY", omiseChargeId: chargeId },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Omise error";
    return NextResponse.json({ error: msg }, { status: 502 });
  }

  return NextResponse.json({ qrUrl, chargeId, sandbox: false });
}
