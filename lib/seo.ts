const BASE_URL = process.env.SITE_URL || process.env.NEXTAUTH_URL || "https://inksverse.com";

export function canonicalUrl(path: string): string {
  return `${BASE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

export function mangaUrl(slug: string): string {
  return canonicalUrl(`/content/${slug}`);
}

export function chapterUrl(slug: string, chapterNum: number): string {
  return canonicalUrl(`/content/${slug}/${chapterNum}`);
}

export function genreUrl(genreSlug: string): string {
  return canonicalUrl(`/manga/${genreSlug}`);
}
