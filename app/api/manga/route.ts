import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

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

  const orderBy =
    sort === "latest"
      ? { updatedAt: "desc" as const }
      : sort === "bookmarks"
      ? { bookmarks: { _count: "desc" as const } }
      : { totalViews: "desc" as const };

  const [mangas, total] = await Promise.all([
    prisma.manga.findMany({
      where,
      orderBy,
      take,
      skip,
      include: {
        genres: { include: { genre: { select: { name: true, slug: true } } } },
        chapters: { orderBy: { chapterNum: "desc" }, take: 1 },
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
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const role = (session.user as { role?: string }).role;
  if (role !== "TRANSLATOR" && role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const userId = (session.user as { id: string }).id;

  // Resolve translator record (ADMIN may not have one)
  let translatorId: string | null = null;
  if (role === "TRANSLATOR") {
    const translator = await prisma.translator.findUnique({ where: { userId } });
    if (!translator) {
      return NextResponse.json({ error: "Translator profile not found" }, { status: 403 });
    }
    translatorId = translator.id;
  }

  const body = await req.json();
  const { title, slug, description, originCountry, status, type, coverUrl, genreIds, contentRating } = body;

  if (!title || !slug || !description) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const existing = await prisma.manga.findUnique({ where: { slug } });
  if (existing) {
    return NextResponse.json({ error: "Slug already taken" }, { status: 409 });
  }

  const validRatings = ["EVERYONE", "TEEN", "ADULT"];

  const manga = await prisma.manga.create({
    data: {
      title,
      slug,
      description,
      originCountry: originCountry || "JP",
      status: status || "ONGOING",
      type: type || "MANGA",
      coverUrl: coverUrl || null,
      contentRating: validRatings.includes(contentRating) ? contentRating : "EVERYONE",
      translatorId,
      genres: genreIds
        ? { create: genreIds.map((id: string) => ({ genreId: id })) }
        : undefined,
    },
  });

  return NextResponse.json(manga, { status: 201 });
}
