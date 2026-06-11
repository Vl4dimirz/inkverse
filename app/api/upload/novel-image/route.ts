import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getPresignedUploadUrl } from "@/lib/r2";

const PUBLIC_URL = process.env.CLOUDFLARE_R2_PUBLIC_URL!;
const EXT: Record<string, string> = {
  "image/jpeg": "jpg", "image/jpg": "jpg", "image/png": "png",
  "image/webp": "webp", "image/gif": "gif", "image/avif": "avif",
};

// Presigned PUT for an inline novel illustration (keyed by manga, not chapter,
// so images can be inserted before the chapter is first saved).
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const role = (session.user as { role?: string }).role;
  const userId = (session.user as { id: string }).id;
  if (role !== "TRANSLATOR" && role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { mangaSlug, contentType } = await req.json().catch(() => ({}));
  if (!mangaSlug || !EXT[contentType]) {
    return NextResponse.json({ error: "mangaSlug and a valid image contentType required" }, { status: 400 });
  }

  const manga = await prisma.manga.findUnique({
    where: { slug: mangaSlug },
    select: { id: true, translatorId: true },
  });
  if (!manga) return NextResponse.json({ error: "Manga not found" }, { status: 404 });

  if (role !== "ADMIN") {
    const t = await prisma.translator.findUnique({ where: { userId } });
    if (!t || manga.translatorId !== t.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const ext = EXT[contentType];
  const key = `novel/${manga.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const uploadUrl = await getPresignedUploadUrl(key, contentType);
  return NextResponse.json({ uploadUrl, publicUrl: `${PUBLIC_URL}/${key}` });
}
