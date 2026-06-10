"use client";

import { useState, useEffect } from "react";
import { ArrowUp } from "lucide-react";

export default function ScrollToTop() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const onScroll = () => setShow(window.scrollY > 500);
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  if (!show) return null;

  return (
    <button
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      aria-label="เลื่อนขึ้นบนสุด"
      title="ขึ้นบนสุด"
      className="fixed bottom-20 right-5 z-40 w-12 h-12 rounded-full bg-[var(--bg-surface)] border border-[var(--border)] text-[var(--text-primary)] shadow-lg flex items-center justify-center hover:bg-[var(--bg-card)] hover:border-[#ff2d55]/60 transition-colors"
    >
      <ArrowUp className="w-5 h-5" />
    </button>
  );
}
