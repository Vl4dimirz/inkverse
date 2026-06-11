import Link from "next/link";
import Image from "next/image";
import { formatDistanceToNow } from "date-fns";
import { th } from "date-fns/locale";
import clsx from "clsx";

interface UpdateRowProps {
  slug: string;
  title: string;
  coverUrl?: string | null;
  chapterNum: number;
  chapterTitle?: string | null;
  publishedAt: Date | string;
  isPremium?: boolean;
  type?: string;
}

export default function UpdateRow({
  slug,
  title,
  coverUrl,
  chapterNum,
  chapterTitle,
  publishedAt,
  isPremium,
  type,
}: UpdateRowProps) {
  const timeAgo = formatDistanceToNow(new Date(publishedAt), {
    addSuffix: true,
    locale: th,
  });

  return (
    <Link
      href={`/content/${slug}/${chapterNum}`}
      className="flex items-center gap-3 p-2 rounded-xl bal-invert group"
    >
      <div className="relative w-12 h-16 flex-shrink-0 rounded-lg overflow-hidden bg-[var(--bg-card)]">
        {coverUrl ? (
          <Image
            src={coverUrl}
            alt={title}
            fill
            className="object-cover transition-transform duration-300 group-hover:scale-110"
            sizes="48px"
            unoptimized
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-[var(--bg-card)] to-[var(--bg-surface)]">
            <span className="text-lg opacity-20">📖</span>
          </div>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold text-[var(--text-primary)] line-clamp-1 group-hover:text-[var(--text-primary)] transition-colors">
            {title}
          </p>
          {type === "NOVEL" ? (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--text-primary)] text-[var(--bg-primary)] flex-shrink-0 font-bold">
              นิยาย
            </span>
          ) : type ? (
            <span className="text-[10px] px-1 py-0.5 rounded bg-white/10 text-[var(--text-secondary)] flex-shrink-0">
              {type === "MANGA" ? "มังงะ" : type === "MANHWA" ? "มังฮวา" : type === "MANHUA" ? "มังฮัว" : type}
            </span>
          ) : null}
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <span
            className={clsx(
              "text-xs font-medium",
              isPremium ? "text-[var(--text-primary)]" : "text-[var(--text-primary)]"
            )}
          >
            {isPremium ? "🔒 " : ""}ตอนที่ {chapterNum}
            {chapterTitle ? ` — ${chapterTitle}` : ""}
          </span>
        </div>
        <p className="text-xs text-[var(--text-secondary)] mt-0.5">{timeAgo}</p>
      </div>
    </Link>
  );
}
