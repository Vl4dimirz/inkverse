import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { renderNovel, novelStats } from "@/lib/markdown";
import { isChapterLive } from "@/lib/chapters";
import { syncMangaLatestChapter } from "@/lib/mangaStats";
import { notifyNewChapter } from "@/lib/notifications";
import { revalidateMangaCache } from "@/lib/revalidate";
import { apiError } from "@/lib/apiError";

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
  if (!chapter) return apiError("CREATE-003", 404);
  return NextResponse.json(chapter);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const chapter = await getOwnership(id);
  if (!chapter) return apiError("CREATE-003", 404);

  const body = await req.json().catch(() => ({})) as {
    title?: string;
    isPremium?: boolean;
    coinCost?: number;
    chapterNum?: number;
    content?: string;
    status?: string;
    publishAt?: string | null;
    authorNote?: string;
    freeAt?: string | null;
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
    if (!body.isPremium) data.freeAt = null; // free chapter has no early-access window
  }
  if (typeof body.coinCost === "number" && body.isPremium !== false) {
    data.coinCost = Math.max(1, body.coinCost);
  }
  // Early access: freeAt = future date → auto-free then; null → permanent premium.
  if (body.freeAt === null) data.freeAt = null;
  else if (typeof body.freeAt === "string") {
    const f = new Date(body.freeAt);
    if (!isNaN(f.getTime())) data.freeAt = f;
  }
  if (typeof body.chapterNum === "number" && Number.isFinite(body.chapterNum) && body.chapterNum >= 0) {
    data.chapterNum = body.chapterNum;
  }

  // Snapshot the about-to-be-replaced version so it can be restored later.
  // Throttled (≤1 per 10 min) so frequent autosaves don't spam the table.
  if (typeof data.content === "string" && data.content !== chapter.content && chapter.content) {
    const last = await prisma.chapterRevision.findFirst({
      where: { chapterId: id },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    });
    if (!last || Date.now() - last.createdAt.getTime() > 10 * 60 * 1000) {
      await prisma.chapterRevision.create({
        data: {
          chapterId: id,
          title: chapter.title,
          content: chapter.content,
          authorNote: chapter.authorNote,
          words: novelStats(chapter.content).words,
        },
      });
      // Keep only the 30 most recent revisions per chapter.
      const stale = await prisma.chapterRevision.findMany({
        where: { chapterId: id },
        orderBy: { createdAt: "desc" },
        skip: 30,
        select: { id: true },
      });
      if (stale.length) await prisma.chapterRevision.deleteMany({ where: { id: { in: stale.map((s) => s.id) } } });
    }
  }

  try {
    const wasLive = isChapterLive(chapter);
    const updated = await prisma.chapter.update({ where: { id }, data });
    // Status / publishAt / chapterNum edits can change the latest live chapter.
    await syncMangaLatestChapter(chapter.manga.id);
    // Reflect the edit immediately on the story page + home feed.
    revalidateMangaCache(chapter.manga.slug);
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
      return apiError("CREATE-002", 409, { message: "มีตอนหมายเลขนี้อยู่แล้ว" });
    }
    return apiError("CREATE-001", 500, { message: "บันทึกตอนไม่สำเร็จ" });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const chapter = await getOwnership(id);
  if (!chapter) return apiError("CREATE-003", 404);

  // Cascades to pages, unlocked records, read history and comments.
  await prisma.chapter.delete({ where: { id } });
  await syncMangaLatestChapter(chapter.manga.id);
  revalidateMangaCache(chapter.manga.slug);
  return NextResponse.json({ ok: true });
}
