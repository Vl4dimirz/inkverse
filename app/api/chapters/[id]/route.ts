import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

async function getOwnership(chapterId: string) {
  const session = await auth();
  if (!session?.user) return null;
  const role = (session.user as { role?: string }).role;
  const userId = (session.user as { id: string }).id;

  const chapter = await prisma.chapter.findUnique({
    where: { id: chapterId },
    include: { manga: { select: { translatorId: true } } },
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
  };

  const data: Record<string, unknown> = {};
  if (typeof body.title === "string") data.title = body.title || null;
  if (typeof body.isPremium === "boolean") {
    data.isPremium = body.isPremium;
    data.coinCost = body.isPremium ? (typeof body.coinCost === "number" ? Math.max(1, body.coinCost) : chapter.coinCost || 2) : 0;
  }
  if (typeof body.coinCost === "number" && body.isPremium !== false) {
    data.coinCost = Math.max(1, body.coinCost);
  }

  const updated = await prisma.chapter.update({ where: { id }, data });
  return NextResponse.json(updated);
}
