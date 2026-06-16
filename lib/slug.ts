// In this Next version, dynamic params in a NON-leaf segment (e.g. the [slug]
// in /dashboard/manga/[slug]/write or /content/[slug]/[chapter]) are NOT
// URL-decoded, unlike a leaf [slug] (e.g. /content/[slug]). Thai slugs then
// arrive percent-encoded and miss DB lookups → 404 a real record. Decode
// defensively; a no-op for already-decoded or ASCII slugs.
export function decodeSlug(s: string): string {
  try {
    return decodeURIComponent(s);
  } catch {
    return s; // malformed % sequence — use as-is
  }
}

// Build a URL slug from a title, KEEPING Thai (U+0E00–U+0E7F) so Thai titles get
// a readable slug instead of collapsing to empty. ASCII-lowercased; spaces and
// other characters become hyphens. Used by both the novel and manga create forms.
export function slugify(s: string): string {
  const base = s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9฀-๿]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return base || "untitled";
}
