"use client";

import { useEffect } from "react";

// Runs only inside the Capacitor app. Makes the WebView feel like a real native
// app instead of a webpage: themes the system status/navigation bars to match the
// black theme and flips on the `.native-app` CSS hooks (no overscroll bounce, no
// long-press callouts, etc.). No-op on the web, so the browser is unaffected.
export default function NativeShell() {
  useEffect(() => {
    const cap = (
      window as unknown as {
        Capacitor?: { Plugins?: Record<string, {
          setOverlaysWebView?: (o: { overlay: boolean }) => Promise<void>;
          setStyle?: (o: { style: string }) => Promise<void>;
          setBackgroundColor?: (o: { color: string }) => Promise<void>;
        }> };
      }
    ).Capacitor;
    if (!cap) return; // web browser → do nothing

    document.documentElement.classList.add("native-app");

    const SB = cap.Plugins?.StatusBar;
    if (SB) {
      // Solid black status bar with light icons, sitting ABOVE the WebView so the
      // page never collides with the clock/battery.
      SB.setOverlaysWebView?.({ overlay: false }).catch(() => {});
      SB.setStyle?.({ style: "DARK" }).catch(() => {});
      SB.setBackgroundColor?.({ color: "#000000" }).catch(() => {});
    }
  }, []);

  return null;
}
