"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PenTool, Loader2, ArrowRight } from "lucide-react";
import TagInput from "@/components/ui/TagInput";
import { slugify } from "@/lib/slug";

export default function NewNovelForm({ genres = [] }: { genres?: { id: string; name: string }[] }) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [genreIds, setGenreIds] = useState<string[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const toggleGenre = (id: string) =>
    setGenreIds((g) => (g.includes(id) ? g.filter((x) => x !== id) : [...g, id]));

  async function create() {
    if (!title.trim()) {
      setError("กรุณาใส่ชื่อเรื่อง");
      return;
    }
    setLoading(true);
    setError("");
    // Send a clean slug; the API appends -2, -3, … only if it's already taken.
    const slug = slugify(title);
    try {
      const res = await fetch("/api/manga", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          slug,
          description: desc.trim() || title.trim(),
          type: "NOVEL",
          originCountry: "TH",
          contentRating: "TEEN",
          genreIds,
          tags,
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(d.error || "สร้างเรื่องไม่สำเร็จ");
        return;
      }
      const m = await res.json();
      router.push(`/dashboard/manga/${m.slug}/write`);
    } catch {
      setError("เครือข่ายขัดข้อง");
    } finally {
      setLoading(false);
    }
  }

  const input =
    "w-full bg-[var(--bg-card)] border border-[var(--border)] px-4 py-3 text-[var(--text-primary)] focus:outline-none focus:border-[var(--text-primary)]/50";

  return (
    <div className="max-w-xl mx-auto px-4 sm:px-6 py-10">
      <p className="eyebrow text-[var(--text-secondary)]">WRITE</p>
      <h1 className="font-bebas text-4xl text-[var(--text-primary)] tracking-wider flex items-center gap-3 mb-2">
        <PenTool className="w-7 h-7" /> เขียนนิยายเรื่องใหม่
      </h1>
      <p className="text-sm text-[var(--text-secondary)] mb-6">
        ใส่ชื่อเรื่องแล้วเริ่มเขียนได้เลย — รายละเอียด/ปก/ตอน แก้เพิ่มทีหลังได้
      </p>

      <div className="space-y-4">
        <label className="block">
          <span className="block text-xs text-[var(--text-secondary)] uppercase tracking-wide mb-1">ชื่อเรื่อง *</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="เช่น รักนี้ที่ปลายฟ้า" className={input} maxLength={120} autoFocus />
        </label>
        <label className="block">
          <span className="block text-xs text-[var(--text-secondary)] uppercase tracking-wide mb-1">เรื่องย่อ (ไม่บังคับ)</span>
          <textarea value={desc} onChange={(e) => setDesc(e.target.value)} rows={3} placeholder="เกริ่นเรื่องสั้นๆ..." className={`${input} resize-y`} maxLength={1000} />
        </label>

        {genres.length > 0 && (
          <div>
            <span className="block text-xs text-[var(--text-secondary)] uppercase tracking-wide mb-1.5">หมวดหมู่ / แท็ก (เลือกได้หลายอัน)</span>
            <div className="flex flex-wrap gap-1.5">
              {genres.map((g) => (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => toggleGenre(g.id)}
                  className={`px-2.5 py-1 rounded-full text-xs border transition-colors ${
                    genreIds.includes(g.id)
                      ? "bg-[var(--text-primary)] text-[var(--bg-primary)] border-[var(--text-primary)]"
                      : "border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                  }`}
                >
                  {g.name}
                </button>
              ))}
            </div>
          </div>
        )}

        <div>
          <span className="block text-xs text-[var(--text-secondary)] uppercase tracking-wide mb-1">แท็ก (พิมพ์เองได้)</span>
          <TagInput value={tags} onChange={setTags} />
        </div>

        {error && <p className="text-sm text-[var(--text-primary)]">{error}</p>}

        <button onClick={create} disabled={loading} className="w-full py-3 bal-btn font-semibold flex items-center justify-center gap-2 disabled:opacity-60">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
          สร้างเรื่อง + เริ่มเขียนตอนแรก
        </button>
      </div>
    </div>
  );
}
