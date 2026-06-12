"use client";

import { useState, useEffect } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Logo from "@/components/ui/Logo";
import { Mail, Lock, User, Eye, EyeOff, Gift } from "lucide-react";
import Link from "next/link";

export default function SignUpPage() {
  const router = useRouter();
  const [form, setForm] = useState({ username: "", email: "", password: "" });
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const [ref, setRef] = useState("");
  const [inApp, setInApp] = useState(false);

  // Capture an invite code (?ref=username) without needing a Suspense boundary.
  useEffect(() => {
    const r = new URLSearchParams(window.location.search).get("ref");
    if (r) setRef(r);
    // Google OAuth can't complete in the app's WebView → hide it in-app.
    setInApp(!!(window as unknown as { Capacitor?: unknown }).Capacitor);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(ref ? { ...form, ref } : form),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error || "เกิดข้อผิดพลาด");
      setLoading(false);
      return;
    }

    if (data.needsVerification) {
      // Email sent — they must verify to activate the welcome bonus.
      setSent(true);
      setLoading(false);
      return;
    }

    await signIn("credentials", {
      email: form.email,
      password: form.password,
      redirect: false,
    });
    router.push("/");
  };

  // Google: native account picker inside the app, normal OAuth on the web.
  const handleGoogle = async () => {
    if (!inApp) {
      signIn("google", { callbackUrl: "/" });
      return;
    }
    const GA = (
      window as unknown as {
        Capacitor?: { Plugins?: { GoogleAuth?: {
          initialize: (o?: Record<string, unknown>) => Promise<void>;
          signIn: () => Promise<{ authentication?: { idToken?: string } }>;
        } } };
      }
    ).Capacitor?.Plugins?.GoogleAuth;
    if (!GA) {
      setError("เปิดผ่านแอปเพื่อใช้ Google หรือสมัครด้วยอีเมล");
      return;
    }
    setError("");
    setLoading(true);
    try {
      await GA.initialize();
      const res = await GA.signIn();
      const idToken = res?.authentication?.idToken;
      if (!idToken) throw new Error("no-token");
      const r = await signIn("google-native", { idToken, redirect: false });
      if (r?.error) setError("เข้าสู่ระบบ Google ไม่สำเร็จ");
      else router.push("/");
    } catch {
      setError("ยกเลิก หรือเข้าสู่ระบบ Google ไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  };

  const inputCls =
    "w-full bg-[var(--bg-card)] border border-[var(--border)] rounded-xl py-3 text-sm text-[var(--text-primary)] placeholder-gray-500 focus:outline-none focus:border-[var(--text-primary)]/60 transition-colors";

  if (sent) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--bg-primary)] px-4">
        <div className="w-full max-w-md bg-[var(--bg-surface)] rounded-2xl border border-[var(--border)] p-8 text-center">
          <div className="w-14 h-14 mx-auto mb-4 flex items-center justify-center bg-[var(--text-primary)] text-[var(--bg-primary)] rounded-full">
            <Mail className="w-7 h-7" />
          </div>
          <h1 className="font-bebas text-3xl text-[var(--text-primary)] tracking-wider">ตรวจสอบอีเมลของคุณ</h1>
          <p className="text-sm text-[var(--text-secondary)] mt-3 leading-relaxed">
            เราส่งลิงก์ยืนยันไปที่<br />
            <span className="text-[var(--text-primary)] font-semibold">{form.email}</span><br />
            กดลิงก์ในอีเมลเพื่อยืนยัน แล้ว<span className="text-[var(--text-primary)]">รับ 20 เหรียญต้อนรับ</span>
          </p>
          <p className="text-xs text-[var(--text-muted)] mt-4">ไม่เห็นอีเมล? ลองเช็คในกล่อง Junk / Spam</p>
          <Link href="/auth/signin" className="inline-block mt-6 px-6 py-3 bal-btn text-sm font-semibold uppercase tracking-widest">
            ไปหน้าเข้าสู่ระบบ
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--bg-primary)] px-4">
      <div className="w-full max-w-md">
        <div className="flex justify-center mb-8">
          <Logo size="lg" href="/" />
        </div>

        <div className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border)] p-8">
          <h1 className="font-bebas text-3xl text-[var(--text-primary)] tracking-wider text-center mb-6">
            สมัครสมาชิก
          </h1>

          {ref && (
            <div className="flex items-center justify-center gap-2 mb-6 px-4 py-2 border border-[var(--border)] bg-[var(--bg-card)] text-xs text-[var(--text-secondary)] uppercase tracking-widest">
              <Gift className="w-3.5 h-3.5" />
              ได้รับเชิญโดย @{ref} · รับ 50 เหรียญเมื่อเติมครั้งแรก
            </div>
          )}

          {/* Google — web only for now; native in-app sign-in temporarily off. */}
          {!inApp && (
          <button
            onClick={handleGoogle}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 py-3 rounded-xl bg-white text-gray-800 text-sm font-medium hover:bg-gray-100 transition-colors mb-6 disabled:opacity-60"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            สมัครด้วย Google
          </button>
          )}

          {!inApp && (
          <div className="flex items-center gap-3 mb-6">
            <div className="flex-1 h-px bg-white/10" />
            <span className="text-xs text-[var(--text-secondary)]">หรือ</span>
            <div className="flex-1 h-px bg-white/10" />
          </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-secondary)]" />
              <input
                type="text"
                value={form.username}
                onChange={(e) => setForm({ ...form, username: e.target.value })}
                placeholder="ชื่อผู้ใช้"
                required
                className={`${inputCls} pl-10`}
              />
            </div>

            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-secondary)]" />
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="อีเมล"
                required
                className={`${inputCls} pl-10`}
              />
            </div>

            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-secondary)]" />
              <input
                type={showPw ? "text" : "password"}
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                placeholder="รหัสผ่าน (อย่างน้อย 8 ตัว)"
                required
                minLength={8}
                className={`${inputCls} pl-10 pr-10`}
              />
              <button
                type="button"
                onClick={() => setShowPw(!showPw)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
              >
                {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            {error && (
              <p className="text-sm text-[var(--text-primary)] text-center">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl bal-btn font-semibold text-sm hover:opacity-90 transition-colors disabled:opacity-50"
            >
              {loading ? "กำลังสมัคร..." : "สมัครสมาชิก"}
            </button>
          </form>

          <p className="text-center text-sm text-[var(--text-secondary)] mt-6">
            มีบัญชีแล้ว?{" "}
            <Link href="/auth/signin" className="text-[var(--text-primary)] hover:text-[var(--text-primary)] transition-colors">
              เข้าสู่ระบบ
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
