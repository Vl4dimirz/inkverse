import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createBankPayout } from "@/lib/omise-payout";

const PLATFORM_CUT = 0.20;   // 20% platform fee
const NET_RATE = 0.80;        // translator receives 80%
const MIN_NET = 100;          // minimum ฿100 after cut
const MIN_GROSS = Math.ceil(MIN_NET / NET_RATE); // = 125

export async function GET() {
  const session = await auth();
  const role = (session?.user as { role?: string })?.role;
  if (!session?.user || (role !== "TRANSLATOR" && role !== "ADMIN")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = (session.user as { id: string }).id;
  const translator = await prisma.translator.findUnique({ where: { userId } });
  if (!translator) return NextResponse.json({ error: "Not a translator" }, { status: 403 });

  const requests = await prisma.withdrawalRequest.findMany({
    where: { translatorId: translator.id },
    orderBy: { requestedAt: "desc" },
  });

  return NextResponse.json(
    requests.map((r) => ({
      ...r,
      requestedAt: r.requestedAt.toISOString(),
      processedAt: r.processedAt?.toISOString() ?? null,
    }))
  );
}

export async function POST(req: NextRequest) {
  const session = await auth();
  const role = (session?.user as { role?: string })?.role;
  if (!session?.user || (role !== "TRANSLATOR" && role !== "ADMIN")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = (session.user as { id: string }).id;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true },
  });
  const translator = await prisma.translator.findUnique({ where: { userId } });
  if (!translator) return NextResponse.json({ error: "Not a translator" }, { status: 403 });

  const body = await req.json().catch(() => ({})) as {
    amount?: number;
    paymentMethod?: string;
    accountName?: string;
    accountNumber?: string;
    bankName?: string;
    bankCode?: string;
  };

  const { amount, paymentMethod, accountName, accountNumber, bankName, bankCode } = body;

  if (!amount || amount < MIN_GROSS) {
    return NextResponse.json({
      error: `ยอดขั้นต่ำในการถอน ฿${MIN_GROSS} (รับจริง ฿${MIN_NET} หลังหักค่าแพลตฟอร์ม 20%)`,
    }, { status: 400 });
  }
  if (!paymentMethod || !["PROMPTPAY", "BANK_TRANSFER"].includes(paymentMethod)) {
    return NextResponse.json({ error: "กรุณาเลือกช่องทางการรับเงิน" }, { status: 400 });
  }
  if (!accountName?.trim()) {
    return NextResponse.json({ error: "กรุณากรอกชื่อบัญชี" }, { status: 400 });
  }
  if (!accountNumber?.trim()) {
    return NextResponse.json({ error: "กรุณากรอกเบอร์ / เลขบัญชี" }, { status: 400 });
  }
  if (paymentMethod === "BANK_TRANSFER" && !bankCode?.trim()) {
    return NextResponse.json({ error: "กรุณาเลือกธนาคาร" }, { status: 400 });
  }

  // Check available balance
  const [earningsAgg, withdrawnAgg] = await Promise.all([
    prisma.translatorEarning.aggregate({
      where: { translatorId: translator.id },
      _sum: { amount: true },
    }),
    prisma.withdrawalRequest.aggregate({
      where: { translatorId: translator.id, status: { notIn: ["REJECTED", "FAILED"] } },
      _sum: { amount: true },
    }),
  ]);
  const available = (earningsAgg._sum.amount ?? 0) - (withdrawnAgg._sum.amount ?? 0);

  if (amount > available + 0.001) {
    return NextResponse.json(
      { error: `ยอดเงินคงเหลือไม่เพียงพอ (มี ฿${available.toFixed(2)})` },
      { status: 400 }
    );
  }

  // Create the withdrawal request first (PENDING)
  const request = await prisma.withdrawalRequest.create({
    data: {
      translatorId: translator.id,
      amount,
      paymentMethod,
      accountName: accountName.trim(),
      accountNumber: accountNumber.trim(),
      bankName: bankName?.trim() ?? null,
      bankCode: bankCode?.trim() ?? null,
      status: "PENDING",
    },
  });

  // Net amount after 20% platform cut
  const platformFee = Math.round(amount * PLATFORM_CUT * 100) / 100;
  const netAmount = Math.round(amount * NET_RATE * 100) / 100;

  // Auto-payout for BANK_TRANSFER via Omise
  if (paymentMethod === "BANK_TRANSFER" && bankCode && process.env.OMISE_SECRET_KEY) {
    try {
      const result = await createBankPayout({
        name: translator.penName,
        email: user?.email ?? `${userId}@inkverse.io`,
        bankCode,
        accountNumber: accountNumber.trim(),
        accountName: accountName.trim(),
        amountTHB: netAmount,           // send NET amount to bank
        metadata: {
          withdrawalId: request.id,
          translatorId: translator.id,
          grossAmount: String(amount),
          platformFee: String(platformFee),
          netAmount: String(netAmount),
        },
      });

      if (result.success) {
        await prisma.withdrawalRequest.update({
          where: { id: request.id },
          data: {
            status: "PROCESSING",
            omiseRecipientId: result.recipientId,
            omiseTransferId: result.transferId,
          },
        });
        return NextResponse.json({ ok: true, id: request.id, auto: true, netAmount, platformFee });
      } else {
        // Payout failed — keep as PENDING for manual admin processing
        await prisma.withdrawalRequest.update({
          where: { id: request.id },
          data: { adminNote: `Auto-payout failed: ${result.error}` },
        });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Auto-payout error";
      await prisma.withdrawalRequest.update({
        where: { id: request.id },
        data: { adminNote: `Auto-payout error: ${msg}` },
      });
    }
  }

  // PromptPay or fallback: stays as PENDING for admin
  return NextResponse.json({ ok: true, id: request.id, auto: false, netAmount, platformFee });
}
