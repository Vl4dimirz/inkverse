"use client";

import { useState } from "react";
import { Copy, Check, Download, Image as ImageIcon } from "lucide-react";

type Work = { slug: string; title: string; coverUrl: string | null; type: string };

const CHIP =
  "px-3 py-1.5 border border-[var(--border)] text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--text-primary)]/50 transition-colors rounded inline-flex items-center gap-1.5";

function CopyBtn({ text, label, done }: { text: string; label: string; done: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {}
      }}
      className={CHIP}
    >
      {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
      {copied ? done : label}
    </button>
  );
}

// Fetch the generated promo card and download it (so the creator can post it as
// an IMAGE on IG/TikTok, where links aren't clickable).
function DownloadCard({ slug, format, label }: { slug: string; format: "square" | "story"; label: string }) {
  const [busy, setBusy] = useState(false);
  return (
    <button
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          const res = await fetch(`/api/promo/${encodeURIComponent(slug)}?format=${format}`);
          if (!res.ok) throw new Error();
          const blob = await res.blob();
          const a = document.createElement("a");
          a.href = URL.createObjectURL(blob);
          a.download = `inkverse-${slug}-${format}.png`;
          document.body.appendChild(a);
          a.click();
          a.remove();
          URL.revokeObjectURL(a.href);
        } catch {} finally {
          setBusy(false);
        }
      }}
      className={CHIP}
    >
      <Download className="w-3.5 h-3.5" />
      {busy ? "กำลังสร้าง..." : label}
    </button>
  );
}

export default function PromoteKit({ works }: { works: Work[] }) {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const enc = encodeURIComponent;

  return (
    <div className="space-y-8">
      <section>
        <h2 className="font-bebas text-2xl text-[var(--text-primary)] tracking-[0.15em] uppercase mb-3">แชร์ผลงานของคุณ</h2>
        {works.length === 0 ? (
          <p className="text-sm text-[var(--text-secondary)]">ยังไม่มีผลงาน — ลงเรื่องก่อนแล้วกลับมาแชร์ได้เลย</p>
        ) : (
          <div className="space-y-3">
            {works.map((w) => {
              const url = `${origin}/content/${w.slug}`;
              const caption = `อ่าน "${w.title}" ที่ INKVERSE ฟรีทุกตอน! ${url}`;
              const shares = [
                { label: "X", href: `https://twitter.com/intent/tweet?text=${enc(`อ่าน "${w.title}" ที่ INKVERSE`)}&url=${enc(url)}` },
                { label: "Facebook", href: `https://www.facebook.com/sharer/sharer.php?u=${enc(url)}` },
                { label: "LINE", href: `https://social-plugins.line.me/lineit/share?url=${enc(url)}&text=${enc(`อ่าน "${w.title}" ที่ INKVERSE`)}` },
              ];
              return (
                <div key={w.slug} className="flex flex-col sm:flex-row gap-4 border border-[var(--border)] bg-[var(--bg-surface)] p-4">
                  <div className="w-16 h-[5.5rem] shrink-0 overflow-hidden border border-[var(--border)] bg-[var(--bg-card)]">
                    {w.coverUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={w.coverUrl} alt={w.title} className="w-full h-full object-cover" />
                    ) : null}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-[var(--text-primary)] truncate">{w.title}</p>
                    <p className="text-[11px] text-[var(--text-secondary)] mb-2.5 uppercase">{w.type}</p>

                    {/* Link / caption / social share */}
                    <div className="flex flex-wrap gap-2">
                      <CopyBtn text={url} label="คัดลอกลิงก์" done="คัดลอกแล้ว" />
                      {shares.map((s) => (
                        <a key={s.label} href={s.href} target="_blank" rel="noopener noreferrer" className={CHIP}>{s.label}</a>
                      ))}
                      <CopyBtn text={caption} label="คัดลอกแคปชั่น" done="คัดลอกแคปชั่นแล้ว" />
                    </div>

                    {/* Downloadable promo card — for IG/TikTok (post as an image) */}
                    <div className="mt-3 pt-3 border-t border-[var(--border)]">
                      <p className="text-[11px] text-[var(--text-secondary)] mb-2 flex items-center gap-1.5">
                        <ImageIcon className="w-3.5 h-3.5" /> การ์ดโปรโมท (โพสต์เป็นรูปลง IG / TikTok / Stories)
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <DownloadCard slug={w.slug} format="square" label="การ์ดจัตุรัส (IG/FB)" />
                        <DownloadCard slug={w.slug} format="story" label="การ์ด Story/TikTok (9:16)" />
                        <a href={`/api/promo/${enc(w.slug)}?format=square`} target="_blank" rel="noopener noreferrer" className={CHIP}>ดูตัวอย่าง</a>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <div className="border border-[var(--border)] bg-[var(--bg-card)] p-4 text-sm text-[var(--text-secondary)] space-y-2">
        <p className="text-[var(--text-primary)] font-semibold">เคล็ดลับโปรโมต (ดึงคนจริง ไม่ใช่บอท)</p>
        <p>📲 <span className="text-[var(--text-primary)]">IG / TikTok ลิงก์กดไม่ได้</span> → โพสต์ <span className="text-[var(--text-primary)]">การ์ดโปรโมท (รูป)</span> ด้านบนแทน คนเห็นแล้วค้นชื่อเรื่องบน INKVERSE ได้เลย</p>
        <p>👥 โพสต์ให้ <span className="text-[var(--text-primary)]">แฟนจริงที่คุณมีอยู่แล้ว</span> (เพจ/กลุ่ม FB, X #นิยายวาย #มังงะแปลไทย, Discord) — คนจริงคลิกเข้ามา ดีกว่ายิง ads ที่ได้แต่บอท</p>
        <p>🔁 โพสต์ทุกตอนใหม่ + แปะลิงก์เรื่องไว้ใน bio — สม่ำเสมอ = คนกลับมาเรื่อยๆ</p>
      </div>
    </div>
  );
}
