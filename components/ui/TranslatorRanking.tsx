import Link from "next/link";
import { Eye } from "lucide-react";

export interface TranslatorRankEntry {
  penName: string;
  username: string;
  avatarUrl: string | null;
  views: number;
  works: number;
}

const MEDAL = ["text-yellow-400", "text-gray-300", "text-amber-600"];

export default function TranslatorRanking({ entries }: { entries: TranslatorRankEntry[] }) {
  if (entries.length === 0) return null;

  return (
    <section className="mb-10">
      <h2 className="font-bebas text-2xl text-[var(--text-primary)] tracking-wider mb-4 flex items-center gap-2">
        <span className="w-1 h-6 bg-[var(--accent)] rounded-full" />
        อันดับนักแปล
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {entries.map((t, i) => (
          <Link
            key={t.username}
            href={`/profile/${t.username}`}
            className="flex items-center gap-3 bg-[var(--bg-surface)] rounded-xl border border-[var(--border)] p-3 hover:border-[var(--text-primary)]/40 transition-colors"
          >
            <span className={`font-bebas text-2xl w-7 text-center shrink-0 ${MEDAL[i] ?? "text-[var(--text-secondary)]"}`}>
              {i + 1}
            </span>
            <div className="relative w-11 h-11 rounded-full overflow-hidden bg-[var(--bg-card)] shrink-0">
              {t.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={t.avatarUrl} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-sm font-bold text-white bg-[var(--accent)]">
                  {t.penName[0]?.toUpperCase()}
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-[var(--text-primary)] truncate">{t.penName}</p>
              <p className="text-xs text-[var(--text-secondary)] flex items-center gap-2 mt-0.5">
                <span className="inline-flex items-center gap-1">
                  <Eye className="w-3 h-3" />{t.views.toLocaleString()}
                </span>
                <span>· {t.works} ผลงาน</span>
              </p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
