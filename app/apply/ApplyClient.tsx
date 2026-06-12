"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PenTool, BookOpen, Heart, ChevronRight, ChevronLeft, Check, AlertCircle, Percent, FileText } from "lucide-react";
import clsx from "clsx";

interface Genre { id: string; name: string; slug: string }
interface PrevApp { status: string; penName: string; adminNote?: string | null }

const STEPS = [
  { id: 1, label: "ข้อมูลพื้นฐาน",  icon: PenTool },
  { id: 2, label: "ผลงาน & โซเชียล", icon: BookOpen },
  { id: 3, label: "แรงจูงใจ",         icon: Heart },
];

const EXPERIENCE_OPTIONS = [
  "ไม่มีประสบการณ์ (มือใหม่)",
  "น้อยกว่า 6 เดือน",
  "6 เดือน – 1 ปี",
  "1 – 3 ปี",
  "มากกว่า 3 ปี",
];

export default function ApplyClient({ genres, prevApplication, mode = "translator" }: {
  genres: Genre[];
  prevApplication: PrevApp | null;
  mode?: "translator" | "writer";
}) {
  const router = useRouter();
  const isWriter = mode === "writer";
  const role = isWriter ? "นักเขียน" : "นักแปล";
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const [form, setForm] = useState({
    penName: prevApplication?.penName ?? "",
    experience: "",
    sampleWork: "",
    socialLink: "",
    preferredGenres: [] as string[],
    motivation: "",
  });

  const [acceptedTerms, setAcceptedTerms] = useState(false);

  const set = (k: keyof typeof form, v: string | string[]) =>
    setForm((f) => ({ ...f, [k]: v }));

  function toggleGenre(slug: string) {
    set(
      "preferredGenres",
      form.preferredGenres.includes(slug)
        ? form.preferredGenres.filter((s) => s !== slug)
        : [...form.preferredGenres, slug]
    );
  }

  function canNext() {
    if (step === 1) return form.penName.trim().length >= 2 && form.experience;
    if (step === 2) return form.sampleWork.trim().length >= 20;
    return true;
  }

  async function handleSubmit() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, acceptedTerms, kind: isWriter ? "WRITER" : "TRANSLATOR" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "เกิดข้อผิดพลาด");
      if (data.autoApproved) {
        // Instant approval → straight to the creator dashboard.
        router.push("/dashboard");
        router.refresh();
        return;
      }
      setDone(true);
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center px-4">
        <div className="text-center">
          <div className="w-20 h-20 rounded-full bg-[var(--bg-card)] border-2 border-[var(--border)] flex items-center justify-center mx-auto mb-6">
            <Check className="w-9 h-9 text-[var(--text-primary)]" />
          </div>
          <h2 className="font-bebas text-3xl text-[var(--text-primary)] tracking-wider mb-2">ส่งใบสมัครแล้ว!</h2>
          <p className="text-[var(--text-secondary)] text-sm">ทีมงานจะตรวจสอบและแจ้งผลภายใน 3-5 วันทำการ</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-10">
      {/* Header */}
      <div className="text-center mb-10">
        <div className="inline-flex items-center gap-2 bg-[var(--text-primary)]/10 border border-[var(--text-primary)]/30 rounded-full px-4 py-1.5 text-sm text-[var(--text-primary)] font-medium mb-4">
          <PenTool className="w-4 h-4" />
          สมัครเป็น{role}
        </div>
        <h1 className="font-bebas text-4xl text-[var(--text-primary)] tracking-wider mb-2">
          ร่วมเป็นส่วนหนึ่งของ INKVERSE
        </h1>
        <p className="text-[var(--text-secondary)] text-sm">
          {isWriter ? "เขียนนิยายของคุณ แล้วหารายได้กับผู้อ่านหลักล้านคน" : "แปลและแบ่งปันผลงานกับผู้อ่านหลักล้านคน"}
        </p>
      </div>

      {/* Rejected notice */}
      {prevApplication?.status === "REJECTED" && (
        <div className="mb-6 flex gap-3 bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-4">
          <AlertCircle className="w-5 h-5 text-[var(--text-primary)] flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm text-[var(--text-primary)] font-medium">ใบสมัครครั้งก่อนไม่ผ่าน</p>
            <p className="text-xs text-[var(--text-secondary)] mt-1">{prevApplication.adminNote ?? "ไม่ผ่านการพิจารณา"}</p>
            <p className="text-xs text-[var(--text-secondary)] mt-1">คุณสามารถสมัครใหม่ได้โดยกรอกข้อมูลด้านล่าง</p>
          </div>
        </div>
      )}

      {/* Step indicator */}
      <div className="flex items-center gap-0 mb-8">
        {STEPS.map((s, i) => {
          const done = step > s.id;
          const active = step === s.id;
          const Icon = s.icon;
          return (
            <div key={s.id} className="flex items-center flex-1">
              <div className={clsx(
                "flex flex-col items-center flex-1",
              )}>
                <div className={clsx(
                  "w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all",
                  done  ? "bg-[var(--text-primary)] border-[var(--text-primary)] text-[var(--bg-primary)]" :
                  active ? "bg-[var(--text-primary)]/20 border-[var(--text-primary)] text-[var(--text-primary)]" :
                           "bg-[var(--bg-surface)] border-[var(--border)] text-[var(--text-secondary)]"
                )}>
                  {done ? <Check className="w-4 h-4" /> : <Icon className="w-4 h-4" />}
                </div>
                <span className={clsx(
                  "text-xs mt-1.5 font-medium",
                  active ? "text-[var(--text-primary)]" : done ? "text-[var(--text-primary)]" : "text-[var(--text-muted)]"
                )}>
                  {s.label}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <div className={clsx(
                  "h-0.5 flex-1 -mt-5 mx-2 transition-all",
                  step > s.id ? "bg-[var(--text-primary)]" : "bg-white/10"
                )} />
              )}
            </div>
          );
        })}
      </div>

      {/* Form card */}
      <div className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border)] p-6 space-y-5">
        {/* ── Step 1: ข้อมูลพื้นฐาน ── */}
        {step === 1 && (
          <>
            <FormField label="นามปากกา *" hint="ชื่อที่จะแสดงต่อผู้อ่าน">
              <input
                value={form.penName}
                onChange={(e) => set("penName", e.target.value)}
                placeholder="เช่น ดาวเรือง TL, NightReader"
                maxLength={40}
                className={inputCls}
              />
            </FormField>

            <FormField label="ระดับประสบการณ์ *">
              <div className="grid grid-cols-1 gap-2">
                {EXPERIENCE_OPTIONS.map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => set("experience", opt)}
                    className={clsx(
                      "text-left px-4 py-3 rounded-xl border text-sm transition-all",
                      form.experience === opt
                        ? "border-[var(--text-primary)]/60 bg-[var(--text-primary)]/10 text-[var(--text-primary)]"
                        : "border-[var(--border)] bg-[var(--bg-card)] text-[var(--text-secondary)] hover:border-white/25"
                    )}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </FormField>
          </>
        )}

        {/* ── Step 2: ผลงาน & โซเชียล ── */}
        {step === 2 && (
          <>
            <FormField
              label="ตัวอย่างผลงาน *"
              hint={isWriter
                ? "ลิงก์งานเขียนที่ผ่านมา หรือวางตัวอย่างงานเขียนของคุณ (อย่างน้อย 20 ตัวอักษร)"
                : "ลิงก์ผลงานแปลที่ผ่านมา หรือวางตัวอย่างข้อความที่แปล (อย่างน้อย 20 ตัวอักษร)"}
            >
              <textarea
                value={form.sampleWork}
                onChange={(e) => set("sampleWork", e.target.value)}
                placeholder={isWriter ? "ใส่ลิงก์ผลงาน เช่น https://... หรือวางตัวอย่างงานเขียนของคุณ" : "ใส่ลิงก์ผลงาน เช่น https://... หรือวางตัวอย่างข้อความแปลของคุณ"}
                rows={5}
                className={`${inputCls} resize-none`}
              />
              <p className="text-xs text-[var(--text-muted)] mt-1">{form.sampleWork.trim().length} / 20 ตัวอักษรขั้นต่ำ</p>
            </FormField>

            <FormField
              label="โซเชียลมีเดีย"
              hint="Facebook, Twitter/X, Discord หรืออื่นๆ (ไม่บังคับ)"
            >
              <input
                value={form.socialLink}
                onChange={(e) => set("socialLink", e.target.value)}
                placeholder="https://facebook.com/yourpage"
                className={inputCls}
              />
            </FormField>

            <FormField label="หมวดหมู่ที่ถนัด" hint="เลือกได้หลายหมวด">
              <div className="flex flex-wrap gap-2">
                {genres.map((g) => (
                  <button
                    key={g.slug}
                    type="button"
                    onClick={() => toggleGenre(g.slug)}
                    className={clsx(
                      "px-3 py-1.5 rounded-full text-xs font-medium transition-all border",
                      form.preferredGenres.includes(g.slug)
                        ? "bg-[var(--text-primary)]/20 border-[var(--text-primary)]/60 text-[var(--text-primary)]"
                        : "bg-[var(--bg-card)] border-[var(--border)] text-[var(--text-secondary)] hover:border-white/25"
                    )}
                  >
                    {g.name}
                  </button>
                ))}
              </div>
            </FormField>
          </>
        )}

        {/* ── Step 3: แรงจูงใจ ── */}
        {step === 3 && (
          <>
            <FormField
              label="แรงจูงใจในการสมัคร *"
              hint={`บอกเล่าว่าทำไมคุณถึงอยากเป็น${role}บน INKVERSE`}
            >
              <textarea
                value={form.motivation}
                onChange={(e) => set("motivation", e.target.value)}
                placeholder="เช่น ฉันชอบอ่านมังงะมาตั้งแต่เด็ก และอยากให้คนไทยได้อ่านเรื่องที่ชอบเหมือนกัน..."
                rows={6}
                className={`${inputCls} resize-none`}
              />
            </FormField>

            {/* Summary */}
            <div className="bg-[var(--bg-card)] rounded-xl p-4 space-y-2 text-sm">
              <p className="text-[var(--text-secondary)] text-xs uppercase tracking-wider mb-3">สรุปใบสมัคร</p>
              <SummaryRow label="นามปากกา" value={form.penName} />
              <SummaryRow label="ประสบการณ์" value={form.experience} />
              <SummaryRow label="หมวดหมู่ที่ถนัด" value={form.preferredGenres.join(", ") || "—"} />
            </div>

            {/* ── เงื่อนไข & ส่วนแบ่งรายได้ ── */}
            <div className="rounded-xl border border-[var(--border)] overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-3 bg-[var(--bg-card)] border-b border-[var(--border)]">
                <FileText className="w-4 h-4 text-[var(--text-primary)]" />
                <span className="text-sm font-semibold text-[var(--text-primary)]">เงื่อนไขสำหรับ{role}</span>
              </div>

              {/* ส่วนแบ่งรายได้ — เน้น 20% */}
              <div className="m-4 flex items-center gap-3 rounded-xl bg-gradient-to-r from-[var(--accent)]/15 to-[var(--accent)]/15 border border-[var(--text-primary)]/30 px-4 py-3">
                <div className="w-10 h-10 rounded-lg bg-[var(--text-primary)]/20 flex items-center justify-center shrink-0">
                  <Percent className="w-5 h-5 text-[var(--text-primary)]" />
                </div>
                <div className="text-sm">
                  <p className="text-[var(--text-primary)] font-semibold">ส่วนแบ่งรายได้ 80 / 20</p>
                  <p className="text-[var(--text-secondary)] text-xs mt-0.5">
                    เมื่อผู้อ่านใช้เหรียญปลดล็อกตอนของคุณ คุณได้รับ{" "}
                    <span className="text-[var(--text-primary)] font-semibold">80%</span> ของมูลค่า และแพลตฟอร์มหัก{" "}
                    <span className="text-[var(--text-primary)] font-semibold">20%</span> เป็นค่าบริการ (ระบบ เซิร์ฟเวอร์ และการชำระเงิน)
                  </p>
                </div>
              </div>

              <ul className="px-4 pb-4 space-y-2 text-xs text-[var(--text-secondary)] leading-relaxed">
                {[
                  "การถอนเงิน: ถอนรายได้สะสมผ่านระบบเมื่อถึงยอดขั้นต่ำตามที่แพลตฟอร์มกำหนด",
                  "ลิขสิทธิ์: คุณยืนยันว่ามีสิทธิ์ในการเผยแพร่ผลงานที่ลงในเว็บ และรับผิดชอบเองหากเกิดการละเมิดลิขสิทธิ์ของผู้อื่น",
                  "คุณภาพ: รักษามาตรฐานผลงานและอัปเดตอย่างสม่ำเสมอ ทีมงานมีสิทธิ์ตรวจสอบและลบเนื้อหาที่ไม่ได้มาตรฐาน",
                  "เนื้อหาต้องห้าม: ห้ามเนื้อหาผิดกฎหมาย ลามกอนาจารผู้เยาว์ หรือเนื้อหาที่สร้างความเกลียดชัง",
                  "การระงับสิทธิ์: หากฝ่าฝืนเงื่อนไข แพลตฟอร์มมีสิทธิ์ระงับสถานะครีเอเตอร์และรายได้ที่เกี่ยวข้อง",
                  "เงื่อนไขอาจมีการปรับปรุงได้ โดยจะแจ้งให้ทราบล่วงหน้า",
                ].map((t, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="text-[var(--text-primary)] mt-0.5">•</span>
                    <span>{t}</span>
                  </li>
                ))}
              </ul>

              {/* Checkbox ยอมรับ */}
              <label className="flex items-start gap-3 px-4 py-3.5 bg-[var(--bg-card)] border-t border-[var(--border)] cursor-pointer">
                <span
                  className={clsx(
                    "mt-0.5 w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-all",
                    acceptedTerms ? "bg-[var(--text-primary)] border-[var(--text-primary)]" : "border-white/25 bg-transparent"
                  )}
                >
                  {acceptedTerms && <Check className="w-3.5 h-3.5 text-[var(--text-primary)]" />}
                </span>
                <input
                  type="checkbox"
                  checked={acceptedTerms}
                  onChange={(e) => setAcceptedTerms(e.target.checked)}
                  className="sr-only"
                />
                <span className="text-sm text-[var(--text-primary)]">
                  ฉันได้อ่านและ<span className="text-[var(--text-primary)] font-medium">ยอมรับเงื่อนไขทั้งหมด</span> รวมถึงส่วนแบ่งรายได้ 80/20 (แพลตฟอร์มหัก 20%)
                </span>
              </label>
            </div>

            {error && (
              <div className="flex gap-2 bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-3">
                <AlertCircle className="w-4 h-4 text-[var(--text-primary)] flex-shrink-0 mt-0.5" />
                <p className="text-sm text-[var(--text-primary)]">{error}</p>
              </div>
            )}
          </>
        )}
      </div>

      {/* Navigation */}
      <div className="flex justify-between mt-6">
        <button
          onClick={() => setStep((s) => s - 1)}
          disabled={step === 1}
          className="flex items-center gap-2 px-5 py-3 rounded-xl bg-[var(--bg-surface)] border border-[var(--border)] text-[var(--text-primary)] text-sm hover:border-white/30 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <ChevronLeft className="w-4 h-4" />
          ย้อนกลับ
        </button>

        {step < 3 ? (
          <button
            onClick={() => setStep((s) => s + 1)}
            disabled={!canNext()}
            className="flex items-center gap-2 px-6 py-3 rounded-xl bal-btn text-sm font-semibold hover:opacity-90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            ถัดไป
            <ChevronRight className="w-4 h-4" />
          </button>
        ) : (
          <button
            onClick={handleSubmit}
            disabled={loading || !form.motivation.trim() || !acceptedTerms}
            className="flex items-center gap-2 px-6 py-3 rounded-xl bal-btn text-sm font-semibold hover:opacity-90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {loading ? "กำลังส่ง..." : "ส่งใบสมัคร"}
            {!loading && <Check className="w-4 h-4" />}
          </button>
        )}
      </div>
    </div>
  );
}

function FormField({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-[var(--text-primary)] mb-1">{label}</label>
      {hint && <p className="text-xs text-[var(--text-secondary)] mb-2">{hint}</p>}
      {children}
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2">
      <span className="text-[var(--text-secondary)] w-32 flex-shrink-0">{label}</span>
      <span className="text-[var(--text-primary)] truncate">{value || "—"}</span>
    </div>
  );
}

const inputCls =
  "w-full bg-[var(--bg-card)] border border-[var(--border)] rounded-xl px-4 py-3 text-sm text-[var(--text-primary)] placeholder-gray-500 focus:outline-none focus:border-[var(--text-primary)]/50 transition-colors";
