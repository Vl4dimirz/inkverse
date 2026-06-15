import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { uploadToR2 } from "@/lib/r2";
import sharp from "sharp";
import { apiError } from "@/lib/apiError";

const MAX_SIZE = 5 * 1024 * 1024; // 5 MB

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return apiError("AUTH-007", 401);
  }

  const role = (session.user as { role?: string }).role;
  const userId = (session.user as { id: string }).id;
  if (role !== "TRANSLATOR" && role !== "ADMIN") {
    return apiError("UP-004", 403);
  }

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const slug = formData.get("slug") as string | null;

  if (!file || !slug) {
    return apiError("VAL-001", 400);
  }

  if (file.size > MAX_SIZE) {
    return apiError("UP-003", 413, { message: "ไฟล์ปกใหญ่เกินไป (สูงสุด 5MB)" });
  }

  // The cover key is derived from the slug, so guard against a creator overwriting
  // another creator's existing cover. New uploads (slug not yet a manga) pass through.
  if (role !== "ADMIN") {
    const existing = await prisma.manga.findUnique({ where: { slug }, select: { translatorId: true } });
    if (existing) {
      const t = await prisma.translator.findUnique({ where: { userId } });
      if (!t || existing.translatorId !== t.id) {
        return apiError("UP-004", 403);
      }
    }
  }

  const isR2Ready = !!(
    process.env.CLOUDFLARE_R2_ACCOUNT_ID &&
    process.env.CLOUDFLARE_R2_ACCESS_KEY_ID &&
    process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY &&
    process.env.CLOUDFLARE_R2_BUCKET_NAME &&
    process.env.CLOUDFLARE_R2_PUBLIC_URL
  );

  if (!isR2Ready) {
    return NextResponse.json({ url: null, warning: "R2 not configured — cover skipped" });
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  // Convert to WebP and generate two sizes
  const [cover, thumb] = await Promise.all([
    sharp(buffer).resize(300, 400, { fit: "cover" }).webp({ quality: 85 }).toBuffer(),
    sharp(buffer).resize(150, 200, { fit: "cover" }).webp({ quality: 75 }).toBuffer(),
  ]);

  const [coverUrl] = await Promise.all([
    uploadToR2(`covers/${slug}.webp`, cover, "image/webp"),
    uploadToR2(`covers/${slug}-thumb.webp`, thumb, "image/webp"),
  ]);

  return NextResponse.json({ url: coverUrl });
}
