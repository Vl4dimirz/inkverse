import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

// DELETE /api/comment/[id] — own comment or admin
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const userId = (session.user as { id: string }).id;
  const role = (session.user as { role?: string }).role;

  const comment = await prisma.comment.findUnique({ where: { id } });
  if (!comment) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (comment.userId !== userId && role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Delete replies first, then the comment
  await prisma.comment.deleteMany({ where: { parentId: id } });
  await prisma.comment.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}

// PATCH /api/comment/[id] — toggle this user's like
export async function PATCH(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const userId = (session.user as { id: string }).id;

  const comment = await prisma.comment.findUnique({ where: { id }, select: { id: true } });
  if (!comment) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // The CommentLike row is the source of truth; Comment.likes is the cached count.
  // Both sides of the toggle run in one transaction so the count never drifts.
  const result = await prisma.$transaction(async (tx) => {
    const existing = await tx.commentLike.findUnique({
      where: { userId_commentId: { userId, commentId: id } },
      select: { id: true },
    });
    if (existing) {
      await tx.commentLike.delete({ where: { id: existing.id } });
      const c = await tx.comment.update({
        where: { id },
        data: { likes: { decrement: 1 } },
        select: { likes: true },
      });
      return { likes: Math.max(0, c.likes), liked: false };
    }
    await tx.commentLike.create({ data: { userId, commentId: id } });
    const c = await tx.comment.update({
      where: { id },
      data: { likes: { increment: 1 } },
      select: { likes: true },
    });
    return { likes: c.likes, liked: true };
  });

  return NextResponse.json(result);
}
