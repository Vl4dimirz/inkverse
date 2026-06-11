import Image from "next/image";
import type { ReactNode } from "react";
import { Crown, PenTool, BadgeCheck, Feather } from "lucide-react";
import SnakeFrame from "./SnakeFrame";

type FrameKind = "reader" | "translator" | "admin";
type Seal = "crown" | "pen" | "check" | null;

interface FrameStyle {
  border: string; // complete Tailwind class string (literal — JIT-scannable)
  innerRing: boolean;
  outerRing: boolean;
  brackets: boolean;
  shimmer: boolean;
  seal: Seal;
  penAccent: boolean;
  snake: boolean;
}

const DEFAULTS = {
  innerRing: false, outerRing: false, brackets: false, shimmer: false,
  seal: null as Seal, penAccent: false, snake: false,
};

function readerFrame(level: number): FrameStyle {
  switch (level) {
    case 1: return { ...DEFAULTS, border: "border border-[var(--text-primary)]/25" };
    case 2: return { ...DEFAULTS, border: "border-2 border-[var(--text-primary)]/45" };
    case 3: return { ...DEFAULTS, border: "border-2 border-[var(--text-primary)]/55", innerRing: true };
    case 4: return { ...DEFAULTS, border: "border-2 border-[var(--text-primary)]/55", innerRing: true, brackets: true };
    case 5: return { ...DEFAULTS, border: "border-2 border-[var(--text-primary)]/70", outerRing: true };
    case 6: return { ...DEFAULTS, border: "border-2 border-[var(--text-primary)]/80", innerRing: true, outerRing: true, brackets: true };
    case 7: return { ...DEFAULTS, border: "border border-[var(--text-primary)]/60", innerRing: true, shimmer: true };
    default: return { ...DEFAULTS, border: "border-2 border-[var(--text-primary)]", brackets: true, shimmer: true, seal: "crown" };
  }
}

function translatorFrame(level: number): FrameStyle {
  switch (level) {
    case 1: return { ...DEFAULTS, border: "border border-[var(--text-primary)]/30", penAccent: true };
    case 2: return { ...DEFAULTS, border: "border-2 border-[var(--text-primary)]/50", brackets: true, penAccent: true };
    case 3: return { ...DEFAULTS, border: "border-2 border-[var(--text-primary)]/65", innerRing: true, brackets: true, penAccent: true };
    case 4: return { ...DEFAULTS, border: "border-2 border-[var(--text-primary)]/80", innerRing: true, outerRing: true, brackets: true, penAccent: true };
    default: return { ...DEFAULTS, border: "border-2 border-[var(--text-primary)]", brackets: true, shimmer: true, seal: "pen", penAccent: true };
  }
}

const ADMIN_FRAME: FrameStyle = {
  ...DEFAULTS, border: "border border-[var(--text-primary)]/40", snake: true,
};

function getFrame(kind: FrameKind, level: number): FrameStyle {
  if (kind === "admin") return ADMIN_FRAME;
  if (kind === "translator") return translatorFrame(level);
  return readerFrame(level);
}

function CornerBrackets() {
  return (
    <>
      <span className="absolute top-0 left-0 w-3.5 h-3.5 border-t-2 border-l-2 border-[var(--text-primary)] z-10" aria-hidden />
      <span className="absolute top-0 right-0 w-3.5 h-3.5 border-t-2 border-r-2 border-[var(--text-primary)] z-10" aria-hidden />
      <span className="absolute bottom-0 left-0 w-3.5 h-3.5 border-b-2 border-l-2 border-[var(--text-primary)] z-10" aria-hidden />
      <span className="absolute bottom-0 right-0 w-3.5 h-3.5 border-b-2 border-r-2 border-[var(--text-primary)] z-10" aria-hidden />
    </>
  );
}

const SEAL_ICON = { crown: Crown, pen: PenTool, check: BadgeCheck } as const;

export default function AvatarFrame({
  kind,
  level,
  avatarUrl,
  username,
  sizeClass = "w-28 h-28 sm:w-32 sm:h-32",
  editSlot,
  verified = false,
}: {
  kind: FrameKind;
  level: number;
  avatarUrl?: string | null;
  username: string;
  sizeClass?: string;
  editSlot?: ReactNode;
  verified?: boolean;
}) {
  const f = getFrame(kind, level);
  const seal: Seal = f.seal ?? (verified ? "check" : null);
  const SealIcon = seal ? SEAL_ICON[seal] : null;
  // Inset the avatar more when a snake coils around it, to clear the body.
  const avInset = f.snake ? "inset-[9px]" : "inset-[5px]";

  return (
    <div className={`relative ${sizeClass} shrink-0`}>
      {/* rotating monochrome halo (top tiers / admin) */}
      {f.shimmer && <div className="absolute -inset-[3px] frame-shimmer" aria-hidden />}
      {/* separator from the banner behind */}
      <div className="absolute inset-0 bg-[var(--bg-primary)]" aria-hidden />
      {/* outer ring */}
      {f.outerRing && (
        <div className="absolute -inset-[2px] border border-[var(--text-primary)]/30 pointer-events-none" aria-hidden />
      )}

      {/* avatar */}
      <div className={`absolute ${avInset} overflow-hidden bg-[var(--bg-card)]`}>
        {avatarUrl ? (
          <Image src={avatarUrl} alt={username} fill unoptimized className="object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center font-bebas text-5xl tracking-wider text-[var(--text-primary)]">
            {username[0]?.toUpperCase()}
          </div>
        )}
      </div>

      {/* serpent coil (admin) */}
      {f.snake && <SnakeFrame />}

      {/* frame border(s) over the avatar edge */}
      <div className={`absolute ${avInset} pointer-events-none ${f.border}`} aria-hidden />
      {f.innerRing && (
        <div className="absolute inset-[9px] border border-[var(--text-primary)]/20 pointer-events-none" aria-hidden />
      )}
      {f.brackets && <CornerBrackets />}

      {/* translator pen accent (top-left) */}
      {f.penAccent && (
        <span className="absolute -top-1.5 -left-1.5 z-20 w-5 h-5 bg-[var(--bg-primary)] border border-[var(--text-primary)]/50 text-[var(--text-primary)] flex items-center justify-center">
          <Feather className="w-2.5 h-2.5" />
        </span>
      )}

      {/* rank / verified seal (bottom-right) */}
      {SealIcon && (
        <span className="absolute -bottom-1.5 -right-1.5 z-20 w-6 h-6 bg-[var(--text-primary)] text-[var(--bg-primary)] flex items-center justify-center">
          <SealIcon className="w-3.5 h-3.5" />
        </span>
      )}

      {/* edit button (own profile) — bottom-left, clear of the seal */}
      {editSlot && <div className="absolute bottom-1 left-1 z-20">{editSlot}</div>}
    </div>
  );
}
