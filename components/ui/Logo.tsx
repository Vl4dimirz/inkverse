"use client";

import Link from "next/link";
import clsx from "clsx";

interface LogoProps {
  variant?: "full" | "icon" | "text";
  size?: "sm" | "md" | "lg";
  className?: string;
  href?: string;
}

const sizes = {
  sm: { tile: 28, font: "text-lg" },
  md: { tile: 36, font: "text-2xl" },
  lg: { tile: 48, font: "text-4xl" },
};

// "IV" monogram tile — matches the app icon / favicon for a unified brand mark.
function MonogramMark({ size = 36 }: { size?: number }) {
  return (
    <span
      aria-hidden
      className="inline-flex items-center justify-center font-bebas text-[var(--bg-primary)] shrink-0 leading-none"
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.1,
        background: "var(--text-primary)",
        fontSize: size * 0.54,
        letterSpacing: size * 0.08,
        paddingTop: size * 0.04,
        paddingLeft: size * 0.08, // offset trailing letter-spacing → stays centered
      }}
    >
      IV
    </span>
  );
}

export default function Logo({
  variant = "full",
  size = "md",
  className,
  href = "/",
}: LogoProps) {
  const { tile, font } = sizes[size];

  const content = (
    <span className={clsx("flex items-center gap-2.5 select-none", className)}>
      {variant !== "text" && <MonogramMark size={tile} />}
      {variant !== "icon" && (
        <span
          className={clsx(
            "font-bebas tracking-[0.18em] text-[var(--text-primary)]",
            font
          )}
        >
          INKVERSE
        </span>
      )}
    </span>
  );

  if (href) {
    return (
      <Link href={href} className="flex items-center" aria-label="INKVERSE">
        {content}
      </Link>
    );
  }

  return content;
}
