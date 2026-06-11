"use client";

import { useState, type ComponentType } from "react";
import { useRouter } from "next/navigation";
import { Globe, Loader2, Check } from "lucide-react";

type Socials = { facebook?: string; x?: string; youtube?: string; tiktok?: string; discord?: string; website?: string };

const FIELDS: { key: keyof Socials; label: string; placeholder: string; icon: ComponentType<{ className?: string }> }[] = [
  { key: "facebook", label: "Facebook / เพจ", placeholder: "https://facebook.com/yourpage", icon: Globe },
  { key: "x", label: "X (Twitter)", placeholder: "https://x.com/yourname", icon: Globe },
  { key: "youtube", label: "YouTube", placeholder: "https://youtube.com/@yourchannel", icon: Globe },
  { key: "tiktok", label: "TikTok", placeholder: "https://tiktok.com/@yourname", icon: Globe },
  { key: "discord", label: "Discord", placeholder: "https://discord.gg/xxxx", icon: Globe },
  { key: "website", label: "เว็บไซต์อื่นๆ", placeholder: "https://...", icon: Globe },
];

export default function CreatorProfileForm({
  initialBio,
  initialSocials,
}: {
  initialBio: string;
  initialSocials: Socials;
}) {
  const router = useRouter();
  const [bio, setBio] = useState(initialBio);
  const [socials, setSocials] = useState<Socials>(initialSocials);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  async function save() {
    setSaving(true);
    setError("");
    setSaved(false);
    try {
      const res = await fetch("/api/translator/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bio, socialLinks: socials }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(d.error || "บันทึกไม่สำเร็จ");
        return;
      }
      setSaved(true);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  const input = "w-full bg-[var(--bg-card)] border border-[var(--border)] px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--text-primary)]/50";

  return (
    <div className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border)] p-5 space-y-4">
      <h2 className="text-sm font-semibold text-[var(--text-primary)] uppercase tracking-wide">โปรไฟล์ครีเอเตอร์</h2>

      <label className="block">
        <span className="block text-xs text-[var(--text-secondary)] mb-1">แนะนำตัว (Bio)</span>
        <textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={3} maxLength={500}
          placeholder="เล่าเกี่ยวกับตัวคุณ / ทีมแปล / ผลงานที่ถนัด" className={`${input} resize-y`} />
      </label>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {FIELDS.map(({ key, label, placeholder, icon: Icon }) => (
          <label key={key} className="block">
            <span className="flex items-center gap-1.5 text-xs text-[var(--text-secondary)] mb-1">
              <Icon className="w-3.5 h-3.5" /> {label}
            </span>
            <input
              value={socials[key] ?? ""}
              onChange={(e) => setSocials((s) => ({ ...s, [key]: e.target.value }))}
              placeholder={placeholder}
              className={input}
            />
          </label>
        ))}
      </div>

      <p className="text-[11px] text-[var(--text-muted)]">ใส่ลิงก์เต็ม (ขึ้นต้นด้วย https://) — เว้นว่างได้ถ้าไม่มี</p>

      {error && <p className="text-sm text-[var(--text-primary)]">{error}</p>}

      <button onClick={save} disabled={saving}
        className="w-full py-2.5 bal-btn text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-60">
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <Check className="w-4 h-4" /> : null}
        {saved ? "บันทึกแล้ว" : "บันทึกโปรไฟล์"}
      </button>
    </div>
  );
}
