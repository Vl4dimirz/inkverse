import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { renderNovel } from "@/lib/markdown";
import { isChapterLive } from "@/lib/chapters";
import { notifyNewChapter } from "@/lib/notifications";

async function getOwnership(chapterId: string) {
  const session = await auth();
  if (!session?.user) return null;
  const role = (session.user as { role?: string }).role;
  const userId = (session.user as { id: string }).id;

  const chapter = await prisma.chapter.findUnique({
    where: { id: chapterId },
    include: { manga: { select: { id: true, title: true, slug: true, translatorId: true } } },
  });
  if (!chapter) return null;

  if (role === "ADMIN") return chapter;

  const translator = await prisma.translator.findUnique({ where: { userId } });
  if (!translator || chapter.manga.translatorId !== translator.id) return null;

  return chapter;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const chapter = await getOwnership(id);
  if (!chapter) return NextResponse.json({ error: "Not found or forbidden" }, { status: 404 });
  return NextResponse.json(chapter);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const chapter = await getOwnership(id);
  if (!chapter) return NextResponse.json({ error: "Not found or forbidden" }, { status: 404 });

  const body = await req.json().catch(() => ({})) as {
    title?: string;
    isPremium?: boolean;
    coinCost?: number;
    chapterNum?: number;
    content?: string;
    status?: string;
    publishAt?: string | null;
    authorNote?: string;
  };

  const data: Record<string, unknown> = {};
  if (typeof body.title === "string") data.title = body.title || null;
  if (typeof body.content === "string") data.content = renderNovel(body.content.slice(0, 500000));
  if (body.status === "DRAFT" || body.status === "PUBLISHED") data.status = body.status;
  if (body.publishAt === null) data.publishAt = null;
  else if (typeof body.publishAt === "string") {
    const d = new Date(body.publishAt);
    if (!isNaN(d.getTime())) data.publishAt = d;
  }
  if (typeof body.authorNote === "string") data.authorNote = body.authorNote.slice(0, 5000) || null;
  if (typeof body.isPremium === "boolean") {
    data.isPremium = body.isPremium;
    data.coinCost = body.isPremium ? (typeof body.coinCost === "number" ? Math.max(1, body.coinCost) : chapter.coinCost || 2) : 0;
  }
  if (typeof body.coinCost === "number" && body.isPremium !== false) {
    data.coinCost = Math.max(1, body.coinCost);
  }
  if (typeof body.chapterNum === "number" && Number.isFinite(body.chapterNum) && body.chapterNum >= 0) {
    data.chapterNum = body.chapterNum;
  }

  try {
    const wasLive = isChapterLive(chapter);
    const updated = await prisma.chapter.update({ where: { id }, data });
    // Notify bookmarkers only when a chapter first becomes live (not on draft saves).
    if (!wasLive && isChapterLive(updated)) {
      await notifyNewChapter({
        mangaId: chapter.manga.id,
        mangaTitle: chapter.manga.title,
        mangaSlug: chapter.manga.slug,
        chapterNum: updated.chapterNum,
      });
    }
    return NextResponse.json(updated);
  } catch (e: unknown) {
    // Unique (mangaId, chapterNum) violation → another chapter already has this number.
    if (typeof e === "object" && e !== null && "code" in e && (e as { code?: string }).code === "P2002") {
      return NextResponse.json({ error: "มีตอนหมายเลขนี้อยู่แล้ว" }, { status: 409 });
    }
    return NextResponse.json({ error: "บันทึกไม่สำเร็จ" }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const chapter = await getOwnership(id);
  if (!chapter) return NextResponse.json({ error: "Not found or forbidden" }, { status: 404 });

  // Cascades to pages, unlocked records, read history and comments.
  await prisma.chapter.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
