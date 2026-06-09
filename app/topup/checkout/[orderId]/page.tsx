import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import CheckoutClient from "./CheckoutClient";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "ชำระเงิน | INKVERSE" };

export default async function CheckoutPage({
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
    include: {
      user: { select: { username: true, email: true, coins: true } },
    },
  });

  if (!order || order.userId !== userId) notFound();
  if (order.status === "PAID") redirect(`/topup/success/${orderId}`);
  if (order.status === "CANCELLED" || order.status === "FAILED") redirect("/topup");

  const pkg = await prisma.coinPackage.findUnique({ where: { id: order.packageId } });

  return (
    <CheckoutClient
      order={{
        id: order.id,
        coins: order.coins,
        bonus: order.bonus,
        price: order.price,
        packageName: pkg?.name ?? "แพ็กเกจเหรียญ",
      }}
      userCoins={order.user.coins}
      isSandbox={!process.env.OMISE_SECRET_KEY}
      omisePublicKey={process.env.NEXT_PUBLIC_OMISE_PUBLIC_KEY}
    />
  );
}
