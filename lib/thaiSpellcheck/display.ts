// Display helper for the spell-check PANEL only (not the document).
// A bare Thai combining mark (tone mark, above/below vowel, การันต์ …) has no
// base consonant to attach to, so on its own it renders as tofu (□) / a broken
// glyph — exactly what an isolated "่่" (double tone mark) error looks like in
// the issues list. Prefix each unattached mark with a DOTTED CIRCLE ◌ (U+25CC),
// the Unicode convention for showing a combining mark in isolation, so the
// writer can actually SEE which mark is wrong. The raw suggestion/offending
// string used for the "แก้" edit stays untouched — this only affects display.

const isThaiConsonant = (c: string | undefined) =>
  c !== undefined && c >= "ก" && c <= "ฮ";

// Combining marks: ◌ั, ◌ิ–◌ฺ (U+0E34–0E3A), ◌็–๎ (U+0E47–0E4E).
// Deliberately EXCLUDES the spacing vowels ะ า ำ ๅ which render fine alone.
const isCombiningMark = (c: string) =>
  c === "ั" || (c >= "ิ" && c <= "ฺ") || (c >= "็" && c <= "๎");

const DOTTED_CIRCLE = "◌";

export function showThaiMarks(s: string): string {
  let out = "";
  for (const ch of s) {
    if (isCombiningMark(ch) && !isThaiConsonant(out[out.length - 1])) {
      out += DOTTED_CIRCLE;
    }
    out += ch;
  }
  return out;
}
