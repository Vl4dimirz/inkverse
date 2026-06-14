import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getPresignedUploadUrlPrivate } from "@/lib/r2";

const EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/avif": "avif",
};

// Verify the signed-in user owns the chapter's manga (translator) or is admin.
async function ownsChapter(chapterId: string) {
  const session = await auth();
  if (!session?.user) return false;
  const role = (session.user as { role?: string }).role;
  const userId = (session.user as { id: string }).id;
  const chapter = await prisma.chapter.findUnique({
    where: { id: chapterId },
    include: { manga: { select: { translatorId: true } } },
  });
  if (!chapter) return false;
  if (role === "ADMIN") return true;
  if (role !== "TRANSLATOR") return false;
  const t = await prisma.translator.findUnique({ where: { userId } });
  return !!t && chapter.manga.translatorId === t.id;
}

// Returns presigned PUT URLs so the browser can upload page images straight to
// R2 (bypassing the serverless request-body limit).
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const chapterId: string = body.chapterId;
  const files: { pageNum: number; contentType: string }[] = Array.isArray(body.files) ? body.files : [];

  if (!chapterId || files.length === 0) {
    return NextResponse.json({ error: "chapterId and files required" }, { status: 400 });
  }
  if (!(await ownsChapter(chapterId))) {
    return NextResponse.json({ error: "Not found or forbidden" }, { status: 403 });
  }

  const uploads = await Promise.all(
    files.map(async (f) => {
      const ct = EXT[f.contentType] ? f.contentType : "image/jpeg";
      const ext = EXT[ct] ?? "jpg";
      const key = `pages/${chapterId}/${f.pageNum}.${ext}`;
      const uploadUrl = await getPresignedUploadUrlPrivate(key, ct);
      return { pageNum: f.pageNum, key, contentType: ct, uploadUrl };
    })
  );

  return NextResponse.json({ uploads });
}
