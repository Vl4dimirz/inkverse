"use client";

import clsx from "clsx";

interface Chip {
  label: string;
  value: string;
}

interface ChipFilterProps {
  chips: Chip[];
  selected: string;
  onChange: (value: string) => void;
  className?: string;
}

export default function ChipFilter({
  chips,
  selected,
  onChange,
  className,
}: ChipFilterProps) {
  return (
    <div
      className={clsx(
        "flex flex-wrap gap-2",
        className
      )}
    >
      {chips.map((chip) => {
        const isActive = chip.value === selected;
        return (
          <button
            key={chip.value}
            onClick={() => onChange(chip.value)}
            className={clsx(
              "px-4 py-1.5 rounded-full text-sm font-medium transition-all duration-200",
              isActive
                ? "bg-[var(--text-primary)] text-[var(--bg-primary)] shadow-lg shadow-[var(--text-primary)]/25"
                : "bg-[var(--bg-card)] text-[var(--text-secondary)] border border-[var(--border)] hover:border-[var(--text-primary)]/40 hover:text-[var(--text-primary)]"
            )}
          >
            {chip.label}
          </button>
        );
      })}
    </div>
  );
}
