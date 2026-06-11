/**
 * Monochrome serpent coiled around a square avatar — the admin frame.
 * Pure SVG, theme-aware (uses --text-primary / --bg-primary).
 */
export default function SnakeFrame() {
  // Centerline of the body: a rounded square loop with a gap at the top
  // (where the head meets the tail).
  const BODY =
    "M58,8 H72 C82,8 92,18 92,28 V72 C92,82 82,92 72,92 H28 C18,92 8,82 8,72 V28 C8,18 18,8 28,8 H42";

  return (
    <svg
      viewBox="0 0 100 100"
      className="absolute inset-0 w-full h-full pointer-events-none drop-shadow-[0_0_2px_rgba(0,0,0,0.6)]"
      fill="none"
      aria-hidden
    >
      {/* body */}
      <path d={BODY} stroke="var(--text-primary)" strokeWidth="8.5" strokeLinecap="round" />
      {/* scale segments (cut across the body in the background colour) */}
      <path
        d={BODY}
        stroke="var(--bg-primary)"
        strokeWidth="8.5"
        strokeLinecap="butt"
        strokeDasharray="1.4 6"
        opacity="0.55"
      />
      {/* belly highlight line */}
      <path d={BODY} stroke="var(--bg-primary)" strokeWidth="1.6" strokeLinecap="round" opacity="0.35" />

      {/* tail taper (sits over the right end of the gap) */}
      <path d="M58,8 L63,4 L60,11 Z" fill="var(--text-primary)" />

      {/* head (left end of the gap), pointing up-left */}
      <path
        d="M43,12 C39,7 41,2 47,3 C52,4 55,8 53,12 C51,15 46,15 43,12 Z"
        fill="var(--text-primary)"
      />
      {/* eye */}
      <circle cx="48.5" cy="7.2" r="1.5" fill="var(--bg-primary)" />
      {/* forked tongue flicking out */}
      <path
        d="M42,9 L33,6 M42,9 L34,11"
        stroke="var(--text-primary)"
        strokeWidth="1.1"
        strokeLinecap="round"
      />
    </svg>
  );
}
