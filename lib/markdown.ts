import sanitizeHtml from "sanitize-html";

const SANITIZE: sanitizeHtml.IOptions = {
  allowedTags: [
    "p", "br", "strong", "em", "u", "s", "h2", "h3",
    "blockquote", "hr", "ul", "ol", "li", "a", "img",
  ],
  allowedAttributes: {
    a: ["href", "title"],
    img: ["src", "alt"],
    "*": ["style"],
  },
  // Only text alignment is allowed through inline styles.
  allowedStyles: {
    "*": { "text-align": [/^(left|right|center|justify)$/] },
  },
  allowedSchemes: ["http", "https", "mailto"],
  allowedSchemesByTag: { img: ["http", "https"] },
  transformTags: {
    a: (_t, attribs) => ({
      tagName: "a",
      attribs: { ...attribs, target: "_blank", rel: "noopener nofollow ugc" },
    }),
  },
};

/**
 * Sanitize a novel chapter's HTML (from the WYSIWYG editor). Run on BOTH write
 * and read — the content is shown to other users, so XSS must be impossible.
 */
export function renderNovel(html: string | null | undefined): string {
  if (!html) return "";
  return sanitizeHtml(html, SANITIZE);
}

/** Word/character counts + reading-time estimate (Thai-aware heuristic). */
export function novelStats(html: string | null | undefined): {
  words: number;
  chars: number;
  minutes: number;
} {
  if (!html) return { words: 0, chars: 0, minutes: 0 };
  const text = html.replace(/<[^>]+>/g, " ").replace(/&[a-z]+;/gi, " ").trim();
  const chars = text.replace(/\s+/g, "").length;
  const thaiChars = (text.match(/[฀-๿]/g) || []).length;
  const latinWords = (text.replace(/[฀-๿]/g, " ").match(/\S+/g) || []).length;
  const words = latinWords + Math.ceil(thaiChars / 3);
  const minutes = Math.max(1, Math.round(words / 200));
  return { words, chars, minutes };
}
