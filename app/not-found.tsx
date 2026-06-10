import Link from "next/link";
import { Home, Search } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center text-center px-4">
      <p className="font-bebas text-8xl sm:text-9xl bg-[var(--accent)] bg-clip-text text-transparent tracking-wider leading-none">
        404
      </p>
      <h1 className="text-xl font-semibold text-[var(--text-primary)] mt-3">ไม่พบหน้าที่คุณกำลังหา</h1>
      <p className="text-sm text-[var(--text-secondary)] mt-2 max-w-md">
        หน้านี้อาจถูกย้าย ลบ หรือไม่เคยมีอยู่ — ลองกลับไปหน้าแรกหรือค้นหามังงะที่คุณชอบ
      </p>
      <div className="flex flex-wrap justify-center gap-3 mt-7">
        <Link
          href="/"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[var(--accent)] text-[var(--text-primary)] text-sm font-semibold hover:opacity-90 transition-opacity"
        >
          <Home className="w-4 h-4" /> หน้าแรก
        </Link>
        <Link
          href="/manga"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[var(--bg-card)] border border-[var(--border)] text-[var(--text-primary)] text-sm font-semibold hover:border-white/30 transition-colors"
        >
          <Search className="w-4 h-4" /> ค้นหามังงะ
        </Link>
      </div>
    </div>
  );
}
