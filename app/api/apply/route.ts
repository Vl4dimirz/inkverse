import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { notifyAdmins, createNotification } from "@/lib/notifications";

// TEMP growth mode: auto-approve creators to recruit fast. Flip off later by
// setting AUTO_APPROVE_CREATORS="false" in the env (no redeploy needed).
const AUTO_APPROVE = process.env.AUTO_APPROVE_CREATORS !== "false";

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ application: null });

  const userId = (session.user as { id: string }).id;
  const application = await prisma.translatorApplication.findUnique({
    where: { userId },
    select: {
      id: true, status: true, penName: true, createdAt: true,
      updatedAt: true, adminNote: true,
    },
  });
  return NextResponse.json({ application });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = (session.user as { id: string }).id;
  const role = (session.user as { role?: string }).role;

  if (role === "TRANSLATOR" || role === "ADMIN") {
    return NextResponse.json({ error: "Already a translator" }, { status: 400 });
  }

  // Check if already applied
  const existing = await prisma.translatorApplication.findUnique({ where: { userId } });
  if (existing && existing.status !== "REJECTED") {
    return NextResponse.json({ error: "Already applied" }, { status: 400 });
  }

  const body = await req.json().catch(() => null);
  const { penName, experience, sampleWork, socialLink, preferredGenres, motivation, acceptedTerms, kind } = body ?? {};
  const appKind = kind === "WRITER" ? "WRITER" : "TRANSLATOR";

  if (!penName?.trim() || !experience?.trim() || !sampleWork?.trim() || !motivation?.trim()) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }
  if (acceptedTerms !== true) {
    return NextResponse.json({ error: "กรุณายอมรับเงื่อนไขก่อนส่งใบสมัคร" }, { status: 400 });
  }

  // Upsert (allow re-apply after rejection)
  const application = existing
    ? await prisma.translatorApplication.update({
        where: { userId },
        data: {
          status: "PENDING",
          kind: appKind,
          penName: penName.trim(),
          experience: experience.trim(),
          sampleWork: sampleWork.trim(),
          socialLink: socialLink?.trim() || null,
          preferredGenres: JSON.stringify(preferredGenres ?? []),
          motivation: motivation.trim(),
          acceptedTerms: true,
          termsAcceptedAt: new Date(),
          adminNote: null,
        },
      })
    : await prisma.translatorApplication.create({
        data: {
          userId,
          kind: appKind,
          penName: penName.trim(),
          experience: experience.trim(),
          sampleWork: sampleWork.trim(),
          socialLink: socialLink?.trim() || null,
          preferredGenres: JSON.stringify(preferredGenres ?? []),
          motivation: motivation.trim(),
          acceptedTerms: true,
          termsAcceptedAt: new Date(),
        },
      });

  const roleWord = appKind === "WRITER" ? "นักเขียน" : "นักแปล";

  if (AUTO_APPROVE) {
    // Instant approval: promote to creator + create the Translator profile.
    await prisma.$transaction([
      prisma.translatorApplication.update({ where: { userId }, data: { status: "APPROVED" } }),
      prisma.user.update({ where: { id: userId }, data: { role: "TRANSLATOR" } }),
      prisma.translator.upsert({
        where: { userId },
        create: { userId, penName: penName.trim(), bio: "", kind: appKind },
        update: { penName: penName.trim(), kind: appKind },
      }),
    ]);
    await createNotification({
      userId,
      type: "APPLICATION_APPROVED",
      title: "อนุมัติแล้ว! 🎉",
      body: `ยินดีต้อนรับ${roleWord}! เข้าแดชบอร์ดเริ่มลงผลงานได้เลย`,
      link: "/dashboard",
    });
    await notifyAdmins({
      type: "NEW_CREATOR",
      title: `${roleWord}ใหม่เข้าร่วม`,
      body: `${penName.trim()} (อนุมัติอัตโนมัติ)`,
      link: "/admin/applications",
    });
    return NextResponse.json({ application, autoApproved: true });
  }

  await notifyAdmins({
    type: "NEW_APPLICATION",
    title: `ใบสมัคร${roleWord}ใหม่`,
    body: `${penName.trim()} สมัครเป็น${roleWord} — รอพิจารณา`,
    link: "/admin/applications",
  });

  return NextResponse.json({ application });
}
