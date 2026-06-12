"use client";

import { useEffect, useRef } from "react";

const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

type TurnstileApi = {
  render: (el: HTMLElement, opts: Record<string, unknown>) => string;
  reset: (id?: string) => void;
};

// Cloudflare Turnstile "I am human" widget. Renders nothing until a site key is
// configured (NEXT_PUBLIC_TURNSTILE_SITE_KEY), so the page works before setup.
export default function Turnstile({ onToken }: { onToken: (token: string) => void }) {
  const boxRef = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | null>(null);
  const cb = useRef(onToken);
  cb.current = onToken;

  useEffect(() => {
    if (!SITE_KEY) return;

    const render = () => {
      const ts = (window as unknown as { turnstile?: TurnstileApi }).turnstile;
      if (!ts || !boxRef.current || widgetId.current) return;
      widgetId.current = ts.render(boxRef.current, {
        sitekey: SITE_KEY,
        theme: "dark",
        callback: (t: string) => cb.current(t),
        "error-callback": () => cb.current(""),
        "expired-callback": () => cb.current(""),
      });
    };

    if ((window as unknown as { turnstile?: TurnstileApi }).turnstile) {
      render();
      return;
    }
    let s = document.getElementById("cf-turnstile-script") as HTMLScriptElement | null;
    if (!s) {
      s = document.createElement("script");
      s.id = "cf-turnstile-script";
      s.src = "https://challenges.cloudflare.com/turnstile/v0/api.js";
      s.async = true;
      s.defer = true;
      document.head.appendChild(s);
    }
    s.addEventListener("load", render);
    return () => s?.removeEventListener("load", render);
  }, []);

  if (!SITE_KEY) return null;
  return <div ref={boxRef} className="flex justify-center my-1" />;
}
