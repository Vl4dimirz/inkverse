import type { Metadata } from "next";
import Link from "next/link";
import {
  Copyright, Wallet, Gift, ShieldCheck, Users, BadgeCheck,
  ArrowRight, Mail, MessageSquare,
} from "lucide-react";

const BASE_URL = process.env.SITE_URL || process.env.NEXTAUTH_URL || "https://inksverse.com";

export const metadata: Metadata = {
  title: "เกี่ยวกับเรา — ทำไมครีเอเตอร์เชื่อใจ INKVERSE | INKVERSE",
  description:
    "INKVERSE คือแพลตฟอร์มอ่าน/ลงงานที่ครีเอเตอร์ไว้ใจได้ — ลิขสิทธิ์เป็นของคุณ 100%, รายได้โปร่งใส 80%, สมัครฟรีไม่มีค่าแรกเข้า, มีระบบปกป้องผลงาน และทีมงานที่ติดต่อได้จริง",
  alternates: { canonical: `${BASE_URL}/about` },
};

const TRUST = [
  {
    icon: Copyright,
    title: "ลิขสิทธิ์เป็นของคุณ 100%",
    body: "เราไม่เคยอ้างสิทธิ์ในผลงานของคุณ คุณเป็นเจ้าของงานเต็มตัว แก้ไข/ลบ/นำออกได้ตลอดเวลา",
  },
  {
    icon: Wallet,
    title: "รายได้โปร่งใส 80%",
    body: "ทุกครั้งที่คนอ่านปลดล็อกตอนด้วยเหรียญ คุณได้ 80% (เราหัก 20% เป็นค่าระบบ) ถอนเข้าบัญชีธนาคารได้จริง",
  },
  {
    icon: Gift,
    title: "สมัครฟรี ไม่มีค่าแรกเข้า",
    body: "ไม่มีค่าสมัคร ไม่มีค่าธรรมเนียมล่วงหน้า เราได้เงินก็ต่อเมื่อคุณได้เงิน — แรงจูงใจของเราคือช่วยให้คุณโต",
  },
  {
    icon: ShieldCheck,
    title: "เราปกป้องผลงานคุณ",
    body: "กันแคปหน้าจอในแอป (FLAG_SECURE), กันบอท/สคริปต์ดึงรูป (Canvas + proxy + signed URL), และมีลายน้ำชื่อผู้อ่านไว้ตามรอยคนปล่อย",
  },
  {
    icon: BadgeCheck,
    title: "ระบบเงินจริง ตรวจสอบได้",
    body: "เติมเหรียญผ่าน PromptPay + ตรวจสลิปอัตโนมัติ (EasySlip) ระบบโปร่งใส มีประวัติธุรกรรมครบ",
  },
  {
    icon: Users,
    title: "มีคนจริงอยู่เบื้องหลัง",
    body: "เราไม่ใช่บอท ติดต่อทีมงานได้จริงผ่านหน้าติดต่อเรา ตอบกลับทุกข้อความ",
  },
];

const FAQ = [
  {
    q: "นี่เป็นเว็บหลอกลวง (scam) ไหม?",
    a: "ไม่ใช่ — รายได้โปร่งใส (80% เข้าคุณ), ลิขสิทธิ์ยังเป็นของคุณ, ไม่เก็บค่าสมัครหรือค่าใดล่วงหน้า, มีระบบถอนเงินจริง และทีมงานที่ติดต่อได้ ทุกอย่างตรวจสอบได้",
  },
  {
    q: "ลงงานแล้วได้เงินจริงไหม?",
    a: "ได้จริง คุณได้ 80% ของทุกการปลดล็อกตอนพรีเมียม ดูยอดรายได้ในแดชบอร์ดแบบเรียลไทม์ แล้วถอนเข้าบัญชีธนาคารได้",
  },
  {
    q: "ต้องจ่ายอะไรก่อนเริ่มไหม?",
    a: "ไม่ต้องเลย สมัครและลงงานฟรี 100% เราไม่มีวันขอเงินจากคุณก่อน — ถ้ามีใครอ้างชื่อเราแล้วขอเงิน นั่นไม่ใช่เรา",
  },
  {
    q: "งานของฉันจะโดนก๊อป/ขโมยไหม?",
    a: "เรามีหลายชั้นป้องกัน: กันแคปหน้าจอในแอป, แสดงรูปผ่าน Canvas (ไม่มีไฟล์ให้เซฟ), proxy + signed URL ที่หมดอายุ, และลายน้ำชื่อผู้อ่านเพื่อตามรอยคนปล่อย",
  },
  {
    q: "ถ้าอยากเลิก หรือเอางานออก?",
    a: "ทำได้ทุกเมื่อ งานเป็นของคุณ 100% ลบหรือนำออกได้เอง ไม่มีข้อผูกมัด",
  },
];

export default function AboutPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12">
      {/* hero */}
      <p className="eyebrow mb-3">INKVERSE</p>
      <h1 className="font-bebas text-4xl sm:text-5xl text-[var(--text-primary)] tracking-[0.06em] uppercase mb-5">
        แพลตฟอร์มที่ครีเอเตอร์ไว้ใจได้
      </h1>
      <div className="space-y-4 text-sm text-[var(--text-secondary)] leading-relaxed max-w-2xl">
        <p>
          INKVERSE คือแพลตฟอร์มอ่านมังงะ มังฮวา มันฮัว และนิยายออนไลน์ ที่สนับสนุนให้
          <span className="text-[var(--text-primary)]"> นักเขียนและนักแปลไทย</span> สร้างผลงานคุณภาพ
          และได้รับค่าตอบแทนที่เป็นธรรมผ่านระบบเหรียญ
        </p>
        <p>
          เรารู้ว่าครีเอเตอร์หลายคนระแวงแพลตฟอร์มใหม่ — กลัวโดนหลอก กลัวไม่ได้เงิน กลัวงานโดนขโมย
          หน้านี้อธิบายตรงๆ ว่าทำไมคุณวางใจเราได้
        </p>
      </div>

      {/* trust grid */}
      <h2 className="font-bebas text-2xl text-[var(--text-primary)] tracking-wide uppercase mt-12 mb-5">
        ทำไมครีเอเตอร์เชื่อใจเรา
      </h2>
      <div className="grid sm:grid-cols-2 gap-3">
        {TRUST.map((t) => (
          <div key={t.title} className="border border-[var(--border)] p-5">
            <t.icon className="w-6 h-6 text-[var(--text-primary)] mb-3" />
            <p className="text-sm font-semibold text-[var(--text-primary)] mb-1.5">{t.title}</p>
            <p className="text-xs text-[var(--text-secondary)] leading-relaxed">{t.body}</p>
          </div>
        ))}
      </div>

      {/* FAQ */}
      <h2 className="font-bebas text-2xl text-[var(--text-primary)] tracking-wide uppercase mt-12 mb-5">
        คำถามที่ครีเอเตอร์ถามบ่อย
      </h2>
      <div className="space-y-3">
        {FAQ.map((f) => (
          <div key={f.q} className="border border-[var(--border)] p-5">
            <p className="text-sm font-semibold text-[var(--text-primary)] mb-2">{f.q}</p>
            <p className="text-xs text-[var(--text-secondary)] leading-relaxed">{f.a}</p>
          </div>
        ))}
      </div>

      {/* contact / verify */}
      <h2 className="font-bebas text-2xl text-[var(--text-primary)] tracking-wide uppercase mt-12 mb-5">
        ติดต่อ &amp; ตรวจสอบเราได้
      </h2>
      <div className="border border-[var(--border)] p-6 space-y-3 text-sm text-[var(--text-secondary)]">
        <p className="flex items-center gap-2.5">
          <MessageSquare className="w-4 h-4 text-[var(--text-primary)] shrink-0" />
          มีคำถาม? ส่งข้อความถึงทีมงานได้ที่{" "}
          <Link href="/contact" className="text-[var(--text-primary)] underline hover:no-underline">หน้าติดต่อเรา</Link>
          {" "}— เราตอบทุกข้อความ
        </p>
        <p className="flex items-center gap-2.5">
          <Mail className="w-4 h-4 text-[var(--text-primary)] shrink-0" />
          อีเมล: <span className="text-[var(--text-primary)]">support@inksverse.com</span>
        </p>
        <p className="text-xs text-[var(--text-muted)] pt-1">
          อ่านเงื่อนไขเต็มได้ที่{" "}
          <Link href="/terms" className="hover:underline">ข้อกำหนด</Link>,{" "}
          <Link href="/privacy" className="hover:underline">นโยบายความเป็นส่วนตัว</Link>,{" "}
          <Link href="/dmca" className="hover:underline">DMCA</Link>
        </p>
      </div>

      {/* CTA */}
      <div className="mt-8 text-center">
        <Link
          href="/creator-101"
          className="inline-flex items-center gap-2 bal-btn px-7 py-3 text-sm font-semibold uppercase tracking-widest"
        >
          เริ่มเป็นครีเอเตอร์
          <ArrowRight className="w-4 h-4" />
        </Link>
        <p className="text-xs text-[var(--text-muted)] mt-3">ดูคู่มือ Creator 101 — สอนลงงาน + ใช้เครื่องมือ ทีละขั้น</p>
      </div>
    </div>
  );
}
