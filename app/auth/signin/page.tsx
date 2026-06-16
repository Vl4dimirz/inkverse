"use client";

import { useState, useEffect } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Logo from "@/components/ui/Logo";
import { Mail, Lock, Eye, EyeOff } from "lucide-react";
import Link from "next/link";

export default function SignInPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [remember, setRemember] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  // In the app we use the NATIVE Google picker. Hide it on Huawei/Honor, which
  // ship without Google Play Services (native Google sign-in can't work — and
  // would crash — there); those users use email/password.
  const [inApp, setInApp] = useState(false);
  const [noGms, setNoGms] = useState(false);
  useEffect(() => {
    setInApp(!!(window as unknown as { Capacitor?: unknown }).Capacitor);
    setNoGms(/huawei|honor/i.test(navigator.userAgent));
  }, []);
  const showGoogle = !inApp || !noGms; // web always; in-app only on GMS devices

  const handleCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    const res = await signIn("credentials", {
      email,
      password,
      remember: remember ? "1" : "0",
      redirect: false,
    });
    setLoading(false);
    if (res?.error) {
      setError("อีเมลหรือรหัสผ่านไม่ถูกต้อง — หรือยังไม่ได้ยืนยันอีเมล (เช็คกล่องจดหมาย/สแปม)");
    } else {
      window.location.href = callbackUrl;
    }
  };

  // Google: native account picker inside the app, normal OAuth on the web.
  const handleGoogle = async () => {
    if (!inApp) {
      signIn("google", { callbackUrl });
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
      setError("เปิดผ่านแอปเพื่อใช้ Google หรือเข้าสู่ระบบด้วยอีเมล");
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
      else window.location.href = callbackUrl;
    } catch {
      setError("ยกเลิก หรือเข้าสู่ระบบ Google ไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  };

  const inputCls =
    "w-full bg-[var(--bg-card)] border border-[var(--border)] rounded-xl py-3 text-sm text-[var(--text-primary)] placeholder-gray-500 focus:outline-none focus:border-[var(--text-primary)]/60 transition-colors";

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--bg-primary)] px-4">
      <div className="w-full max-w-md">
        <div className="flex justify-center mb-8">
          <Logo size="lg" href="/" />
        </div>

        <div className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border)] p-8">
          <h1 className="font-bebas text-3xl text-[var(--text-primary)] tracking-wider text-center mb-6">
            เข้าสู่ระบบ
          </h1>

          {/* Google — native picker in the app (GMS devices), OAuth redirect on
              the web. Hidden on Huawei/Honor (no Play Services). */}
          {showGoogle && (
          <button
            onClick={handleGoogle}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 py-3 rounded-xl bg-white text-gray-800 text-sm font-medium hover:bg-gray-100 transition-colors mb-6 disabled:opacity-60"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            เข้าสู่ระบบด้วย Google
          </button>
          )}

          {showGoogle && (
          <div className="flex items-center gap-3 mb-6">
            <div className="flex-1 h-px bg-white/10" />
            <span className="text-xs text-[var(--text-secondary)]">หรือ</span>
            <div className="flex-1 h-px bg-white/10" />
          </div>
          )}

          {inApp && noGms && (
            <p className="text-xs text-[var(--text-secondary)] text-center mb-6 leading-relaxed">
              เครื่องนี้ไม่รองรับ Google ในแอป กรุณาใช้อีเมล + รหัสผ่าน<br />
              (เคยสมัครด้วย Google? กด &ldquo;ลืมรหัสผ่าน?&rdquo; เพื่อตั้งรหัสผ่านครั้งแรก)
            </p>
          )}

          <form onSubmit={handleCredentials} className="space-y-4">
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-secondary)]" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="อีเมล"
                required
                className={`${inputCls} pl-10`}
              />
            </div>

            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-secondary)]" />
              <input
                type={showPw ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="รหัสผ่าน"
                required
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

            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-xs text-[var(--text-secondary)] cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                  className="w-4 h-4 accent-[var(--text-primary)] cursor-pointer"
                />
                จดจำการเข้าสู่ระบบ
              </label>
              <Link href="/auth/forgot" className="text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors">
                ลืมรหัสผ่าน?
              </Link>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl bal-btn font-semibold text-sm hover:opacity-90 transition-colors disabled:opacity-50"
            >
              {loading ? "กำลังเข้าสู่ระบบ..." : "เข้าสู่ระบบ"}
            </button>
          </form>

          <p className="text-center text-sm text-[var(--text-secondary)] mt-6">
            ยังไม่มีบัญชี?{" "}
            <Link
              href="/auth/signup"
              className="text-[var(--text-primary)] hover:text-[var(--text-primary)] transition-colors"
            >
              สมัครสมาชิก
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
