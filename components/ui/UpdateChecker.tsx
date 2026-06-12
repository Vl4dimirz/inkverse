"use client";

import { useEffect, useState } from "react";
import { isOlder } from "@/lib/appVersion";

type AppPlugin = {
  getInfo: () => Promise<{ version?: string }>;
  addListener?: (
    event: string,
    cb: () => void
  ) => Promise<{ remove: () => void }> | { remove: () => void };
};

// Runs only inside the Capacitor app. Compares the installed APK version against
// the latest published one (/api/app/version) and, if there's a newer native
// build, shows a dismissible banner that opens the new APK in the system browser
// to download + install (one tap). No-op on the web.
export default function UpdateChecker() {
  const [latest, setLatest] = useState<{ version: string; url: string } | null>(null);

  useEffect(() => {
    const cap = (
      window as unknown as { Capacitor?: { Plugins?: { App?: AppPlugin } } }
    ).Capacitor;
    if (!cap) return; // web browser → nothing to update
    const App = cap.Plugins?.App;
    if (!App?.getInfo) return;

    let cancelled = false;

    const check = async () => {
      try {
        const [appInfo, res] = await Promise.all([
          App.getInfo(),
          fetch("/api/app/version", { cache: "no-store" }).then((r) => r.json()),
        ]);
        const installed = appInfo?.version || "0.0.0";
        if (cancelled || !res?.version || !res?.url) return;
        if (!isOlder(installed, res.version)) return;
        if (localStorage.getItem("ivUpdateDismiss") === res.version) return;
        setLatest({ version: res.version, url: res.url });
      } catch {
        /* offline / not in app — ignore */
      }
    };

    check();
    const sub = App.addListener?.("resume", check);

    return () => {
      cancelled = true;
      Promise.resolve(sub).then((s) => s?.remove?.()).catch(() => {});
    };
  }, []);

  if (!latest) return null;

  const download = () => {
    // Absolute URL → Capacitor opens it in the system browser, which downloads
    // the APK and hands off to the Android installer.
    window.open(window.location.origin + latest.url, "_blank");
  };

  const dismiss = () => {
    try {
      localStorage.setItem("ivUpdateDismiss", latest.version);
    } catch {}
    setLatest(null);
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[100] bg-[var(--bg-surface)] border-t border-[var(--border)] px-4 py-3 flex items-center gap-3">
      <div className="flex-1 min-w-0">
        <p className="text-sm text-[var(--text-primary)] font-semibold">มีเวอร์ชันใหม่ {latest.version}</p>
        <p className="text-xs text-[var(--text-secondary)]">แตะอัปเดตเพื่อดาวน์โหลดตัวล่าสุด</p>
      </div>
      <button
        onClick={dismiss}
        className="px-3 py-2 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
      >
        ภายหลัง
      </button>
      <button
        onClick={download}
        className="px-4 py-2 bal-btn text-xs font-semibold uppercase tracking-widest"
      >
        อัปเดต
      </button>
    </div>
  );
}
