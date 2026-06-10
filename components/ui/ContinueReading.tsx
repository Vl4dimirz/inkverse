"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { History } from "lucide-react";

interface Item {
  slug: string;
  title: string;
  coverUrl: string | null;
  chapterNum: number;
}

export default function ContinueReading() {
  const [items, setItems] = useState<Item[] | null>(null);

  useEffect(() => {
    let alive = true;
    fetch("/api/continue-reading")
      .then((r) => (r.ok ? r.json() : { items: [] }))
      .then((d) => { if (alive) setItems(d.items ?? []); })
      .catch(() => { if (alive) setItems([]); });
    return () => { alive = false; };
  }, []);

  if (!items || items.length === 0) return null;

  return (
    <section className="mb-8">
      <h2 className="font-bebas text-2xl text-[var(--text-primary)] tracking-wider mb-4 flex items-center gap-2">
        <History className="w-5 h-5 text-[var(--text-primary)]" /> อ่านต่อ
      </h2>
      <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-none">
        {items.map((it) => (
          <Link key={it.slug} href={`/content/${it.slug}/${it.chapterNum}`} className="shrink-0 w-28 group">
            <div className="relative aspect-[3/4] rounded-xl overflow-hidden border border-[var(--border)] bg-[var(--bg-card)]">
              {it.coverUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={it.coverUrl} alt={it.title} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-2xl opacity-30">📖</div>
              )}
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 to-transparent px-2 py-1.5">
                <span className="text-[10px] text-[var(--text-primary)] font-medium">ตอนที่ {it.chapterNum}</span>
              </div>
            </div>
            <p className="text-xs text-[var(--text-secondary)] mt-1 line-clamp-1 group-hover:text-[var(--text-primary)] transition-colors">
              {it.title}
            </p>
          </Link>
        ))}
      </div>
    </section>
  );
}
