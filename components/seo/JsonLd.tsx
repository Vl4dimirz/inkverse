const BASE_URL = process.env.SITE_URL || process.env.NEXTAUTH_URL || "https://inksverse.com";

// `JSON.stringify` is NOT safe to drop straight into a <script>: it leaves `<`,
// `>`, `&` raw, so a creator-controlled value containing `</script>...` could
// break out of the tag and inject markup (stored XSS). Escape those to \uXXXX —
// still valid JSON. (This is ld+json data, never executed as JS, so the
// U+2028/9 JS-string pitfall doesn't apply.)
function safeJsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/[<>&]/g, (c) => "\\u" + c.charCodeAt(0).toString(16).padStart(4, "0"));
}

interface MangaJsonLdProps {
  manga: {
    title: string;
    slug: string;
    description: string;
    coverUrl?: string | null;
    status: string;
    updatedAt: Date | string;
    genres: { genre: { name: string } }[];
    avgRating?: number;
    ratingCount?: number;
    chapters?: { chapterNum: number }[];
  };
}

export function MangaJsonLd({ manga }: MangaJsonLdProps) {
  const genreNames = manga.genres?.map((g) => g.genre.name) || [];
  const latestChapter = manga.chapters?.length
    ? Math.max(...manga.chapters.map((c) => c.chapterNum))
    : 0;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Book",
    name: manga.title,
    description: manga.description,
    ...(manga.coverUrl ? { image: manga.coverUrl } : {}),
    url: `${BASE_URL}/content/${manga.slug}`,
    inLanguage: "th",
    bookFormat: "https://schema.org/EBook",
    genre: genreNames,
    dateModified: manga.updatedAt
      ? new Date(manga.updatedAt).toISOString()
      : undefined,
    ...(manga.avgRating && manga.avgRating > 0
      ? {
          aggregateRating: {
            "@type": "AggregateRating",
            ratingValue: manga.avgRating.toFixed(1),
            bestRating: "5",
            worstRating: "1",
            ratingCount: manga.ratingCount ?? 1,
          },
        }
      : {}),
    numberOfPages: latestChapter,
    publisher: {
      "@type": "Organization",
      name: "INKVERSE",
      url: BASE_URL,
    },
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: safeJsonLd(jsonLd) }}
    />
  );
}

export function WebsiteJsonLd() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "INKVERSE",
    url: BASE_URL,
    description:
      "ศูนย์รวมมังงะ มังฮวา แปลไทยครบทุกแนว อ่านฟรีไม่มีโฆษณา",
    inLanguage: "th",
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${BASE_URL}/manga?q={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: safeJsonLd(jsonLd) }}
    />
  );
}

export function BreadcrumbJsonLd({
  items,
}: {
  items: { name: string; url: string }[];
}) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      item: item.url,
    })),
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: safeJsonLd(jsonLd) }}
    />
  );
}
