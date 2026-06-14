import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createNotification } from "@/lib/notifications";
import { uploadToR2Private } from "@/lib/r2";
import { rateLimit } from "@/lib/rate-limit";
import { isFirstTopup, extendVipDays, rewardReferralOnFirstTopup } from "@/lib/coins";

// EasySlip API v1 — the image-upload endpoint EasySlip's own clients use.
// (v2 /verify/bank multipart is not parsed by standard HTTP clients; v1 works
//  with the same token and additionally returns the receiver account number.)
const EASYSLIP_URL = "https://developer.easyslip.com/api/v1/verify";
const MAX_SLIP_SIZE = 4 * 1024 * 1024; // 4 MB

// Map EasySlip v1 error codes → friendly Thai messages.
const SLIP_ERRORS: Record<string, string> = {
  duplicate_slip: "สลิปนี้ถูกใช้ไปแล้ว",
  qrcode_not_found: "อ่าน QR ในสลิปไม่ได้ กรุณาอัปโหลดสลิปฉบับเต็มที่ชัดเจน",
  slip_not_found: "ไม่พบข้อมูลสลิป กรุณาอัปโหลดสลิปที่ถูกต้อง",
  invalid_image: "ไฟล์รูปไม่ถูกต้อง",
  image_size_too_large: "ไฟล์รูปใหญ่เกินไป (สูงสุด 4MB)",
  account_not_found: "ไม่พบบัญชีผู้ตรวจสลิป กรุณาติดต่อผู้ดูแลระบบ",
  application_expired: "ระบบตรวจสลิปหมดอายุ กรุณาติดต่อผู้ดูแลระบบ",
  application_deactivated: "ระบบตรวจสลิปถูกปิดใช้งาน กรุณาติดต่อผู้ดูแลระบบ",
  quota_exceeded: "โควต้าตรวจสลิปเต็ม กรุณาลองใหม่ภายหลัง",
  access_denied: "ระบบตรวจสลิปไม่พร้อมใช้งาน กรุณาติดต่อผู้ดูแลระบบ",
  unauthorized: "ระบบตรวจสลิปไม่พร้อมใช้งาน กรุณาติดต่อผู้ดูแลระบบ",
};

interface EasySlipV1Response {
  status?: number;
  message?: string;
  data?: {
    transRef?: string;
    amount?: { amount?: number };
    receiver?: {
      bank?: { id?: string; name?: string; short?: string };
      account?: {
        name?: { th?: string; en?: string };
        bank?: { account?: string };
        proxy?: { account?: string };
      };
    };
  };
}

function digitsOf(value: unknown): string {
  return typeof value === "string" ? value.replace(/\D/g, "") : "";
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  const session = await auth();
  if (!session?.user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const token = process.env.EASYSLIP_TOKEN;
  if (!token)
    return NextResponse.json(
      { error: "ระบบตรวจสลิปยังไม่พร้อมใช้งาน กรุณาติดต่อผู้ดูแลระบบ" },
      { status: 503 }
    );

  const { orderId } = await params;
  const userId = (session.user as { id: string }).id;

  // Each verify call hits the paid EasySlip API — throttle to stop quota/cost abuse.
  const rl = rateLimit(`verify-slip:${userId}`, 6, 5 * 60_000);
  if (!rl.ok)
    return NextResponse.json(
      { error: "ตรวจสลิปบ่อยเกินไป กรุณารอสักครู่แล้วลองใหม่" },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter) } }
    );

  const order = await prisma.coinOrder.findUnique({ where: { id: orderId } });
  if (!order || order.userId !== userId)
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  if (order.status === "PAID")
    return NextResponse.json({ error: "คำสั่งซื้อนี้ชำระเงินแล้ว" }, { status: 409 });
  if (order.status !== "PENDING")
    return NextResponse.json({ error: "คำสั่งซื้อนี้ถูกยกเลิกแล้ว" }, { status: 409 });

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File))
    return NextResponse.json({ error: "กรุณาแนบรูปสลิป" }, { status: 400 });
  if (file.size > MAX_SLIP_SIZE)
    return NextResponse.json({ error: "ไฟล์สลิปใหญ่เกินไป (สูงสุด 4MB)" }, { status: 413 });

  const buffer = Buffer.from(await file.arrayBuffer());

  // ── Verify the slip with EasySlip v1 ─────────────────────────────────────
  let result: EasySlipV1Response;
  try {
    const fd = new FormData();
    fd.append("file", new File([buffer], file.name || "slip.jpg", { type: file.type || "image/jpeg" }));
    fd.append("checkDuplicate", "true");

    const res = await fetch(EASYSLIP_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: fd,
    });
    result = await res.json();
  } catch {
    return NextResponse.json(
      { error: "ตรวจสอบสลิปไม่สำเร็จ กรุณาลองใหม่" },
      { status: 502 }
    );
  }

  // v1: success has `data`; errors return `{ status, message: "<code>" }`.
  if (!result.data) {
    const code = result.message ?? "";
    const friendly = SLIP_ERRORS[code] ?? "ตรวจสอบสลิปไม่สำเร็จ กรุณาตรวจสอบรูปสลิป";
    const httpStatus = code === "duplicate_slip" ? 409 : 422;
    return NextResponse.json({ error: friendly }, { status: httpStatus });
  }

  const data = result.data;

  const transRef = data.transRef;
  if (!transRef)
    return NextResponse.json(
      { error: "อ่านเลขอ้างอิงสลิปไม่ได้ กรุณาอัปโหลดสลิปที่ชัดเจน" },
      { status: 422 }
    );

  // ── Validate amount (must match exactly) ─────────────────────────────────
  const slipAmount = data.amount?.amount ?? 0;
  if (Math.abs(slipAmount - order.price) > 0.01)
    return NextResponse.json(
      {
        error: `ยอดในสลิป (฿${slipAmount.toFixed(2)}) ไม่ตรงกับยอดที่ต้องชำระ (฿${order.price.toFixed(0)}) กรุณาโอนให้ตรงตามจำนวน`,
      },
      { status: 422 }
    );

  // ── Validate receiver is the shop's account ──────────────────────────────
  // v1 returns the (masked) receiver account number, e.g. "xxx-x-x3788-x".
  const last4 = process.env.PROMPTPAY_RECEIVER_LAST4?.trim();
  const expectName = process.env.PROMPTPAY_RECEIVER_NAME?.trim();
  if (last4 || expectName) {
    const acct = data.receiver?.account;
    const acctDigits = [acct?.bank?.account, acct?.proxy?.account].map(digitsOf);
    const receiverName = acct?.name?.th ?? "";
    const matched =
      (!!last4 && acctDigits.some((d) => d.includes(last4))) ||
      (!!expectName && receiverName.includes(expectName));
    if (!matched)
      return NextResponse.json(
        { error: "บัญชีปลายทางในสลิปไม่ตรงกับบัญชีร้าน กรุณาตรวจสอบ" },
        { status: 422 }
      );
  }

  // ── Mark paid + credit coins (guard against duplicate slip & double-credit) ─
  const totalCoins = order.coins + order.bonus;

  // Persist the slip image for records (best-effort).
  let slipUrl: string | null = null;
  const r2Ready = !!(
    process.env.CLOUDFLARE_R2_ACCOUNT_ID &&
    process.env.CLOUDFLARE_R2_ACCESS_KEY_ID &&
    process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY &&
    process.env.CLOUDFLARE_R2_BUCKET_NAME &&
    process.env.CLOUDFLARE_R2_PUBLIC_URL
  );
  if (r2Ready) {
    try {
      const ext = (file.type?.split("/")[1] || "jpg").replace("jpeg", "jpg");
      slipUrl = await uploadToR2Private(`slips/${orderId}.${ext}`, buffer, file.type || "image/jpeg");
    } catch {
      /* non-critical */
    }
  }

  try {
    await prisma.$transaction(async (tx) => {
      // Atomically flip PENDING → PAID. A concurrent request sees 0 rows here
      // and must NOT credit coins again.
      const flipped = await tx.coinOrder.updateMany({
        where: { id: orderId, status: "PENDING" },
        data: {
          status: "PAID",
          method: "PROMPTPAY",
          paidAt: new Date(),
          slipRef: transRef,
          slipUrl,
        },
      });
      if (flipped.count === 0) return; // already processed elsewhere

      const firstTopup = await isFirstTopup(tx, order.userId);
      if (order.vipDays > 0) await extendVipDays(tx, order.userId, order.vipDays);
      if (firstTopup) await rewardReferralOnFirstTopup(tx, order.userId);
      await tx.user.update({
        where: { id: order.userId },
        data: { coins: { increment: totalCoins } },
      });
      await tx.coinTransaction.create({
        data: {
          userId: order.userId,
          amount: totalCoins,
          type: "TOPUP",
          description: `เติมเหรียญ ${totalCoins} เหรียญ (฿${order.price.toFixed(0)})`,
          refId: orderId,
        },
      });
    });
  } catch (err: unknown) {
    // Unique violation on slipRef → this slip was already used for another order.
    const code =
      typeof err === "object" && err !== null && "code" in err
        ? String((err as { code?: string }).code)
        : "";
    if (code === "P2002")
      return NextResponse.json({ error: "สลิปนี้ถูกใช้ไปแล้ว" }, { status: 409 });
    return NextResponse.json(
      { error: "บันทึกการชำระเงินไม่สำเร็จ กรุณาติดต่อผู้ดูแลระบบ" },
      { status: 500 }
    );
  }

  await createNotification({
    userId: order.userId,
    type: "TOPUP_SUCCESS",
    title: "เติมเหรียญสำเร็จ!",
    body: `คุณได้รับ ${totalCoins} เหรียญ (฿${order.price.toFixed(0)}) เรียบร้อยแล้ว`,
    link: "/topup",
  });

  return NextResponse.json({ ok: true, coins: totalCoins });
}
