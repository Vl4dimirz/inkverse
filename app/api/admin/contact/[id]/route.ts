import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendEmail, contactReplyEmail } from "@/lib/email";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if ((session?.user as { role?: string })?.role !== "ADMIN")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const body = await req.json().catch(() => ({}));

  // Reply: email the original sender, store the reply, mark resolved.
  if (typeof body?.reply === "string" && body.reply.trim()) {
    const reply = body.reply.trim().slice(0, 5000);
    const msg = await prisma.contactMessage.findUnique({ where: { id } });
    if (!msg) return NextResponse.json({ error: "ไม่พบข้อความ" }, { status: 404 });

    const emailed = await sendEmail({
      to: msg.email,
      subject: `ตอบกลับ: ${msg.subject || "ข้อความถึงทีมงาน INKVERSE"}`,
      html: contactReplyEmail({ name: msg.name, original: msg.message, reply }),
    });

    const updated = await prisma.contactMessage.update({
      where: { id },
      data: { reply, repliedAt: new Date(), status: "RESOLVED" },
    });
    return NextResponse.json({ ...updated, emailed });
  }

  // Otherwise: just toggle the status.
  const status = body?.status === "RESOLVED" ? "RESOLVED" : "OPEN";
  try {
    const msg = await prisma.contactMessage.update({ where: { id }, data: { status } });
    return NextResponse.json(msg);
  } catch {
    return NextResponse.json({ error: "ไม่พบข้อความ" }, { status: 404 });
  }
}
