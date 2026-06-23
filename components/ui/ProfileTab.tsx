"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, Loader2, Check, AlertCircle } from "lucide-react";
import type { UserData } from "@/components/ui/SettingsTabs";

const field =
  "w-full bg-[var(--bg-card)] border border-[var(--border)] px-3 py-2.5 text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--text-primary)]/50 transition-colors";
const label =
  "block text-xs text-[var(--text-secondary)] uppercase tracking-wider mb-1.5";

// ── Image uploader (avatar or cover) ────────────────────────────────────────

function ImageUploadButton({
  type,
  label: btnLabel,
  className = "",
  onUploaded,
}: {
  type: "avatar" | "cover";
  label: string;
  className?: string;
  onUploaded: (url: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState("");

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploading(true);
    setErr("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("type", type);
      const res = await fetch("/api/profile/image", { method: "POST", body: fd });
      const d = await res.json().catch(() => ({}));
      if (res.ok && (d as { url?: string }).url) {
        onUploaded((d as { url: string }).url);
      } else {
        setErr((d as { error?: string; message?: string }).error ?? (d as { message?: string }).message ?? "อัปโหลดไม่สำเร็จ");
      }
    } catch {
      setErr("เครือข่ายขัดข้อง กรุณาลองใหม่");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        onChange={onPick}
        className="hidden"
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        className={`inline-flex items-center gap-1.5 bg-[var(--text-primary)] text-[var(--bg-primary)] text-xs font-semibold uppercase tracking-widest px-3 py-1.5 hover:opacity-90 transition-opacity disabled:opacity-50 ${className}`}
      >
        {uploading ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : (
          <Camera className="w-3.5 h-3.5" />
        )}
        {btnLabel}
      </button>
      {err && (
        <p className="text-xs text-[var(--text-primary)] mt-1">{err}</p>
      )}
    </div>
  );
}

// ── Main ProfileTab ──────────────────────────────────────────────────────────

export default function ProfileTab({ user }: { user: UserData }) {
  const router = useRouter();

  const [avatarUrl, setAvatarUrl] = useState(user.avatarUrl ?? "");
  const [coverUrl, setCoverUrl] = useState(user.coverUrl ?? "");

  const [name, setName] = useState(user.name ?? "");
  const [bio, setBio] = useState(user.bio ?? "");
  const [website, setWebsite] = useState(user.website ?? "");
  const [location, setLocation] = useState(user.location ?? "");
  const [phone, setPhone] = useState(user.phone ?? "");
  const [recoveryEmail, setRecoveryEmail] = useState(user.recoveryEmail ?? "");

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState("");

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    setSaveError("");
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, bio, website, location, phone, recoveryEmail }),
      });
      const d = await res.json().catch(() => ({}));
      if (res.ok) {
        setSaved(true);
        router.refresh();
      } else {
        setSaveError(
          (d as { message?: string }).message ??
            (d as { error?: string }).error ??
            "บันทึกไม่สำเร็จ กรุณาลองใหม่"
        );
      }
    } catch {
      setSaveError("เครือข่ายขัดข้อง กรุณาลองใหม่");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={save} className="space-y-6">
      {/* Cover image */}
      <div>
        <p className="eyebrow mb-3">ภาพปก</p>
        <div className="relative w-full h-32 bg-[var(--bg-card)] border border-[var(--border)] overflow-hidden">
          {coverUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={coverUrl}
              alt="ภาพปก"
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <span className="text-xs text-[var(--text-muted)] uppercase tracking-widest">
                ยังไม่มีภาพปก
              </span>
            </div>
          )}
          <div className="absolute bottom-2 right-2">
            <ImageUploadButton
              type="cover"
              label="เปลี่ยนภาพปก"
              onUploaded={(url) => {
                setCoverUrl(url);
                router.refresh();
              }}
            />
          </div>
        </div>
      </div>

      {/* Avatar */}
      <div>
        <p className="eyebrow mb-3">รูปโปรไฟล์</p>
        <div className="flex items-center gap-4">
          <div className="relative w-16 h-16 bg-[var(--bg-card)] border border-[var(--border)] overflow-hidden shrink-0">
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={avatarUrl}
                alt="รูปโปรไฟล์"
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <span className="text-lg text-[var(--text-muted)] uppercase font-bebas">
                  {user.username.slice(0, 1)}
                </span>
              </div>
            )}
          </div>
          <ImageUploadButton
            type="avatar"
            label="เปลี่ยนรูปโปรไฟล์"
            onUploaded={(url) => {
              setAvatarUrl(url);
              router.refresh();
            }}
          />
        </div>
      </div>

      {/* Fields */}
      <div className="space-y-4">
        {/* Username — read-only */}
        <div>
          <label className={label}>ชื่อผู้ใช้ (Username)</label>
          <div className="flex items-center gap-2">
            <input
              value={user.username}
              readOnly
              className={`${field} opacity-50 cursor-not-allowed`}
            />
            <span className="shrink-0 text-[10px] uppercase tracking-wider text-[var(--text-muted)] whitespace-nowrap">
              ตั้งครั้งเดียว
            </span>
          </div>
        </div>

        {/* Display name */}
        <div>
          <label className={label}>ชื่อที่แสดง</label>
          <input
            className={field}
            value={name}
            onChange={(e) => { setName(e.target.value); setSaved(false); }}
            placeholder="ชื่อที่แสดงบนโปรไฟล์"
            maxLength={60}
          />
        </div>

        {/* Bio */}
        <div>
          <label className={label}>แนะนำตัว</label>
          <textarea
            className={`${field} min-h-[88px] resize-y`}
            value={bio}
            onChange={(e) => { setBio(e.target.value); setSaved(false); }}
            placeholder="เล่าเกี่ยวกับตัวคุณสักหน่อย"
            maxLength={500}
          />
          <p className="text-[10px] text-[var(--text-muted)] mt-1 text-right">
            {bio.length}/500
          </p>
        </div>

        {/* Recovery email */}
        <div>
          <label className={label}>อีเมลสำรองสำหรับกู้คืนบัญชี</label>
          <input
            type="email"
            className={field}
            value={recoveryEmail}
            onChange={(e) => { setRecoveryEmail(e.target.value); setSaved(false); }}
            placeholder="ไม่บังคับ — ใช้กู้คืนบัญชีเมื่อลืมรหัสผ่าน"
          />
        </div>

        {/* Optional fields header */}
        <p className="text-[10px] uppercase tracking-widest text-[var(--text-muted)] pt-1">
          ไม่บังคับ — กรอกเพื่อเพิ่มความน่าเชื่อถือ
        </p>

        {/* Website */}
        <div>
          <label className={label}>เว็บไซต์</label>
          <input
            type="url"
            className={field}
            value={website}
            onChange={(e) => { setWebsite(e.target.value); setSaved(false); }}
            placeholder="https://yoursite.com"
          />
        </div>

        {/* Location */}
        <div>
          <label className={label}>ที่อยู่ / พื้นที่</label>
          <input
            className={field}
            value={location}
            onChange={(e) => { setLocation(e.target.value); setSaved(false); }}
            placeholder="เช่น กรุงเทพฯ ประเทศไทย"
            maxLength={80}
          />
        </div>

        {/* Phone */}
        <div>
          <label className={label}>เบอร์โทร</label>
          <input
            type="tel"
            className={field}
            value={phone}
            onChange={(e) => { setPhone(e.target.value); setSaved(false); }}
            placeholder="ไม่แสดงสาธารณะ"
            maxLength={20}
          />
        </div>
      </div>

      {/* Error / success */}
      {saveError && (
        <div className="flex items-start gap-2 border border-[var(--border)] px-3 py-2.5 text-sm text-[var(--text-primary)]">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          {saveError}
        </div>
      )}

      <button
        type="submit"
        disabled={saving}
        className="w-full bal-btn py-3 text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
      >
        {saving ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : saved ? (
          <Check className="w-4 h-4" />
        ) : null}
        {saved ? "บันทึกแล้ว" : "บันทึกโปรไฟล์"}
      </button>
    </form>
  );
}
