import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { liveChapterWhere } from "@/lib/chapters";
import { cleanTags } from "@/lib/tags";
import { apiError } from "@/lib/apiError";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const genre = searchParams.get("genre");
  const status = searchParams.get("status");
  const type = searchParams.get("type");
  const sort = searchParams.get("sort") || "views";
  const mine = searchParams.get("mine");
  const page = Number(searchParams.get("page")) || 1;
  const take = Number(searchParams.get("limit")) || 24;
  const skip = (page - 1) * take;

  const where: Record<string, unknown> = {};
  if (status) where.status = status;
  if (type) where.type = type;

  if (genre) {
    const g = await prisma.genre.findUnique({ where: { slug: genre } });
    if (g) where.genres = { some: { genreId: g.id } };
  }

  if (mine === "1") {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ data: [], total: 0, page: 1, totalPages: 0 });
    }
    const userId = (session.user as { id: string }).id;
    const role = (session.user as { role?: string }).role;
    if (role !== "ADMIN") {
      const translator = await prisma.translator.findUnique({ where: { userId } });
      if (!translator) {
        return NextResponse.json({ data: [], total: 0, page: 1, totalPages: 0 });
      }
      where.translatorId = translator.id;
    }
  }

  // The "mine" list feeds the chapter-upload dropdown, so it must show ALL of
  // the user's titles with the newest first (not a views-ranked, paginated page).
  const orderBy =
    mine === "1"
      ? { createdAt: "desc" as const }
      : sort === "latest"
      ? { updatedAt: "desc" as const }
      : sort === "bookmarks"
      ? { bookmarks: { _count: "desc" as const } }
      : { totalViews: "desc" as const };

  const [mangas, total] = await Promise.all([
    prisma.manga.findMany({
      where,
      orderBy,
      take: mine === "1" ? 1000 : take,
      skip: mine === "1" ? 0 : skip,
      include: {
        genres: { include: { genre: { select: { name: true, slug: true } } } },
        chapters: { where: liveChapterWhere(), orderBy: { chapterNum: "desc" }, take: 1 },
        ratings: { select: { score: true } },
      },
    }),
    prisma.manga.count({ where }),
  ]);

  const data = mangas.map((m) => ({
    ...m,
    avgRating:
      m.ratings.length > 0
        ? m.ratings.reduce((a, b) => a + b.score, 0) / m.ratings.length
        : 0,
    latestChapter: m.chapters[0]?.chapterNum ?? null,
    genres: m.genres.map((g) => g.genre),
  }));

  return NextResponse.json({ data, total, page, totalPages: Math.ceil(total / take) });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return apiError("AUTH-007", 401);
  }

  const role = (session.user as { role?: string }).role;
  if (role !== "TRANSLATOR" && role !== "ADMIN") {
    return apiError("AUTH-008", 403);
  }

  const userId = (session.user as { id: string }).id;

  // Link the work to the creator's translator profile so it shows in their
  // dashboard. A TRANSLATOR must have one; an ADMIN links to theirs if they have
  // one (otherwise the work stays unowned = platform content).
  const translator = await prisma.translator.findUnique({ where: { userId } });
  if (role === "TRANSLATOR" && !translator) {
    return apiError("AUTH-008", 403, { message: "ไม่พบโปรไฟล์ครีเอเตอร์" });
  }
  const translatorId: string | null = translator?.id ?? null;

  const body = await req.json();
  const { title, slug, description, originCountry, status, type, coverUrl, genreIds, contentRating, tags } = body;

  if (!title || !slug || !description) {
    return apiError("VAL-001", 400, { message: "กรอกข้อมูลไม่ครบ" });
  }

  const validRatings = ["EVERYONE", "TEEN", "ADULT"];

  // Use a clean slug (just the slugified title). Only if that exact slug is
  // already taken do we append -2, -3, … — so URLs stay pretty by default.
  // Race-safe: slug is @unique, so a concurrent create throws P2002, which we
  // catch and retry with the next suffix.
  const baseSlug = slug;
  let manga = null;
  for (let attempt = 0; attempt < 25; attempt++) {
    const finalSlug = attempt === 0 ? baseSlug : `${baseSlug}-${attempt + 1}`;
    try {
      manga = await prisma.manga.create({
        data: {
          title,
          slug: finalSlug,
          description,
          originCountry: originCountry || "JP",
          status: status || "ONGOING",
          type: type || "MANGA",
          coverUrl: coverUrl || null,
          contentRating: validRatings.includes(contentRating) ? contentRating : "EVERYONE",
          tags: cleanTags(tags),
          translatorId,
          genres: genreIds
            ? { create: genreIds.map((id: string) => ({ genreId: id })) }
            : undefined,
        },
      });
      break;
    } catch (e: unknown) {
      const code = (e as { code?: string })?.code;
      if (code === "P2002" && attempt < 24) continue; // slug taken — try next suffix
      throw e;
    }
  }
  if (!manga) {
    return apiError("CREATE-001", 409, { message: "ตั้งชื่อ slug ไม่สำเร็จ ลองเปลี่ยนชื่อเรื่อง" });
  }

  return NextResponse.json(manga, { status: 201 });
}
