import { MetadataRoute } from "next";
import { prisma } from "@/lib/prisma";

const BASE_URL = process.env.SITE_URL || process.env.NEXTAUTH_URL || "https://inksverse.com";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [mangas, genres, chapters] = await Promise.all([
    prisma.manga.findMany({
      select: { slug: true, updatedAt: true },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.genre.findMany({ select: { slug: true } }),
    // Every live chapter is its own indexable page ("อ่าน X ตอนที่ Y") — long-tail SEO.
    prisma.chapter.findMany({
      where: { status: { not: "DRAFT" }, OR: [{ publishAt: null }, { publishAt: { lte: new Date() } }] },
      select: { chapterNum: true, publishedAt: true, manga: { select: { slug: true } } },
      orderBy: { publishedAt: "desc" },
      take: 40000,
    }),
  ]);

  const staticPages: MetadataRoute.Sitemap = [
    { url: BASE_URL, lastModified: new Date(), changeFrequency: "daily", priority: 1.0 },
    { url: `${BASE_URL}/manga`, lastModified: new Date(), changeFrequency: "daily", priority: 0.9 },
    { url: `${BASE_URL}/manga?type=NOVEL`, lastModified: new Date(), changeFrequency: "daily", priority: 0.8 },
    { url: `${BASE_URL}/discover`, lastModified: new Date(), changeFrequency: "daily", priority: 0.8 },
    { url: `${BASE_URL}/creators`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.6 },
    { url: `${BASE_URL}/download`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.5 },
    { url: `${BASE_URL}/topup`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.5 },
  ];

  const chapterPages: MetadataRoute.Sitemap = chapters.map((c) => ({
    url: `${BASE_URL}/content/${c.manga.slug}/${c.chapterNum}`,
    lastModified: c.publishedAt,
    changeFrequency: "monthly" as const,
    priority: 0.6,
  }));

  const genrePages: MetadataRoute.Sitemap = genres.map((g) => ({
    url: `${BASE_URL}/manga/${g.slug}`,
    lastModified: new Date(),
    changeFrequency: "weekly" as const,
    priority: 0.7,
  }));

  const mangaPages: MetadataRoute.Sitemap = mangas.map((m) => ({
    url: `${BASE_URL}/content/${m.slug}`,
    lastModified: m.updatedAt,
    changeFrequency: "weekly" as const,
    priority: 0.8,
  }));

  return [...staticPages, ...genrePages, ...mangaPages, ...chapterPages];
}
