// Normalise free-form creator tags: trim, strip leading '#', cap length/count,
// drop blanks and case-insensitive duplicates.
export function cleanTags(input: unknown, max = 15): string[] {
  if (!Array.isArray(input)) return [];
  const out: string[] = [];
  for (const t of input) {
    if (typeof t !== "string") continue;
    const c = t.trim().replace(/^#+/, "").slice(0, 30);
    if (c && !out.some((x) => x.toLowerCase() === c.toLowerCase())) out.push(c);
    if (out.length >= max) break;
  }
  return out;
}
