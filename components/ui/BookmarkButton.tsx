"use client";

import { useState } from "react";
import { Bookmark } from "lucide-react";
import clsx from "clsx";

interface BookmarkButtonProps {
  mangaId: string;
  initialBookmarked: boolean;
}

export default function BookmarkButton({
  mangaId,
  initialBookmarked,
}: BookmarkButtonProps) {
  const [bookmarked, setBookmarked] = useState(initialBookmarked);
  const [loading, setLoading] = useState(false);

  const toggle = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/bookmark", {
        method: bookmarked ? "DELETE" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mangaId }),
      });
      if (res.ok) setBookmarked(!bookmarked);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={toggle}
      disabled={loading}
      className={clsx(
        "w-full py-3 rounded-xl border text-sm font-semibold flex items-center justify-center gap-2 transition-all",
        bookmarked
          ? "bg-[var(--text-primary)]/20 border-[var(--text-primary)]/40 text-[var(--text-primary)]"
          : "bg-[var(--bg-card)] border-[var(--border)] text-[var(--text-primary)] hover:border-white/30"
      )}
    >
      <Bookmark
        className={clsx("w-4 h-4", bookmarked && "fill-[var(--text-primary)]")}
      />
      {bookmarked ? "บุ๊กมาร์กแล้ว" : "เพิ่มบุ๊กมาร์ก"}
    </button>
  );
}
