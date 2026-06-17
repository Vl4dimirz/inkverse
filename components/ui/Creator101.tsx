"use client";

import { useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import {
  PenLine, Languages, Bold, Italic, Underline, Strikethrough,
  Heading2, List, ListOrdered, Quote, Minus, Link2, Image as ImageIcon,
  AlignLeft, AlignCenter, AlignRight, Undo2, Redo2, Save, Send, Clock, Coins,
  Wallet, Upload, GripVertical, Megaphone, Type, Target, Maximize2, Search,
  ArrowRight, BadgeCheck, History, RotateCcw, Library, BarChart3, FileDown,
  Sparkles, Eye, Users, MapPin, BookOpen,
} from "lucide-react";

/* ---------- visual building blocks ---------- */

function Step({ n, title, children, last }: { n: number; title: string; children: React.ReactNode; last?: boolean }) {
  return (
    <div className="flex gap-4 sm:gap-6">
      <div className="flex flex-col items-center">
        <div className="w-10 h-10 shrink-0 flex items-center justify-center rounded-full border border-[var(--text-primary)] text-[var(--text-primary)] font-bebas text-xl">
          {n}
        </div>
        {!last && <div className="flex-1 w-px bg-[var(--border)] my-2" />}
      </div>
      <div className={clsx("min-w-0 flex-1", last ? "pb-2" : "pb-10")}>
        <h3 className="font-bebas text-2xl tracking-wide text-[var(--text-primary)]">{title}</h3>
        <div className="mt-2 space-y-3 text-sm text-[var(--text-secondary)] leading-relaxed">{children}</div>
      </div>
    </div>
  );
}

function Mock({ label, children }: { label?: string; children: React.ReactNode }) {
  return (
    <div className="mt-3 border border-[var(--border)] bg-[var(--bg-card)] p-4">
      {label && <div className="text-[10px] uppercase tracking-[0.2em] text-[var(--text-muted)] mb-3">{label}</div>}
      {children}
    </div>
  );
}

function FakeBtn({ children, solid }: { children: React.ReactNode; solid?: boolean }) {
  return (
    <span className={clsx(
      "inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider border whitespace-nowrap",
      solid ? "bg-[var(--text-primary)] text-[var(--bg-primary)] border-[var(--text-primary)]" : "border-[var(--border)] text-[var(--text-primary)]"
    )}>
      {children}
    </span>
  );
}

function ToolBtn({ icon: Icon, name }: { icon: React.ComponentType<{ className?: string }>; name: string }) {
  return (
    <div className="flex flex-col items-center gap-1 w-[52px]">
      <div className="w-9 h-9 flex items-center justify-center border border-[var(--border)] text-[var(--text-primary)]">
        <Icon className="w-4 h-4" />
      </div>
      <span className="text-[9px] text-[var(--text-muted)] text-center leading-tight">{name}</span>
    </div>
  );
}

function Tip({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-3 flex gap-3 border-l-2 border-[var(--text-primary)] pl-3 py-1">
      <span className="text-[10px] uppercase tracking-[0.2em] text-[var(--text-primary)] font-semibold shrink-0 pt-0.5">เคล็ดลับ</span>
      <p className="text-xs text-[var(--text-secondary)] leading-relaxed">{children}</p>
    </div>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return <span className="inline-block border border-[var(--border)] px-2.5 py-1 text-xs text-[var(--text-secondary)]">{children}</span>;
}

/* shared blocks reused by both roles */

function EditorTools() {
  return (
    <>
      <Mock label="แถบเครื่องมือเขียน (Editor)">
        <div className="flex flex-wrap gap-2">
          <ToolBtn icon={Bold} name="ตัวหนา" />
          <ToolBtn icon={Italic} name="เอียง" />
          <ToolBtn icon={Underline} name="ขีดเส้นใต้" />
          <ToolBtn icon={Strikethrough} name="ขีดฆ่า" />
          <ToolBtn icon={Heading2} name="หัวข้อ" />
          <ToolBtn icon={List} name="ลิสต์" />
          <ToolBtn icon={ListOrdered} name="ลิสต์เลข" />
          <ToolBtn icon={Quote} name="อ้างอิง" />
          <ToolBtn icon={Minus} name="คั่นฉาก" />
          <ToolBtn icon={Link2} name="ลิงก์" />
          <ToolBtn icon={ImageIcon} name="แทรกรูป" />
          <ToolBtn icon={AlignLeft} name="ชิดซ้าย" />
          <ToolBtn icon={AlignCenter} name="กึ่งกลาง" />
          <ToolBtn icon={AlignRight} name="ชิดขวา" />
          <ToolBtn icon={Undo2} name="ย้อนกลับ" />
          <ToolBtn icon={Redo2} name="ทำซ้ำ" />
          <ToolBtn icon={Search} name="ค้นหา-แทนที่" />
          <ToolBtn icon={History} name="ประวัติเวอร์ชัน" />
          <ToolBtn icon={Maximize2} name="โหมดโฟกัส" />
        </div>
      </Mock>
      <div className="mt-3 grid sm:grid-cols-2 gap-2">
        {[
          { icon: Type, t: "นับคำอัตโนมัติ", d: "เห็นจำนวนคำ/ตัวอักษรสด" },
          { icon: Target, t: "ตั้งเป้าจำนวนคำ", d: "ตั้งเป้าต่อตอน + แถบความคืบหน้า" },
          { icon: Maximize2, t: "โหมดโฟกัส", d: "เขียนเต็มจอ ไม่มีอะไรกวน" },
          { icon: Search, t: "ค้นหา-แทนที่", d: "แก้คำซ้ำทั้งตอนทีเดียว" },
          { icon: Save, t: "บันทึกอัตโนมัติ", d: "เซฟให้เองทุก 2 วิ ไม่กลัวงานหาย" },
          { icon: ImageIcon, t: "วางจาก Word สะอาด", d: "ก๊อปจาก Word/Docs มาวางได้เลย" },
        ].map((f) => (
          <div key={f.t} className="flex gap-2.5 border border-[var(--border)] p-3">
            <f.icon className="w-4 h-4 text-[var(--text-primary)] shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-semibold text-[var(--text-primary)]">{f.t}</p>
              <p className="text-[11px] text-[var(--text-muted)]">{f.d}</p>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

function MonetizeBlock() {
  return (
    <Mock label="ตั้งราคา / อ่านล่วงหน้า">
      <div className="grid sm:grid-cols-2 gap-3">
        <div className="border border-[var(--border)] p-3">
          <div className="flex items-center gap-2 mb-2">
            <Coins className="w-4 h-4 text-[var(--text-primary)]" />
            <span className="text-xs font-semibold text-[var(--text-primary)]">ตอนพรีเมียม</span>
          </div>
          <p className="text-[11px] text-[var(--text-muted)] mb-2">ตั้งราคาปลดล็อก (เช่น 5 เหรียญ)</p>
          <div className="inline-flex items-center gap-2 border border-[var(--border)] px-3 py-1.5">
            <Coins className="w-3.5 h-3.5" /> <span className="font-bebas text-lg text-[var(--text-primary)]">5</span>
            <span className="text-[10px] text-[var(--text-muted)]">เหรียญ/ตอน</span>
          </div>
        </div>
        <div className="border border-[var(--border)] p-3">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="w-4 h-4 text-[var(--text-primary)]" />
            <span className="text-xs font-semibold text-[var(--text-primary)]">อ่านล่วงหน้า</span>
          </div>
          <p className="text-[11px] text-[var(--text-muted)] mb-2">ติดเหรียญก่อน แล้วปลดฟรีเองตามเวลา</p>
          <div className="inline-flex items-center gap-2 border border-[var(--border)] px-3 py-1.5 text-[11px] text-[var(--text-primary)]">
            ฟรีในวันที่ 25 มิ.ย. 20:00
          </div>
        </div>
      </div>
      <p className="text-[11px] text-[var(--text-muted)] mt-3">
        ปลดล็อกอัตโนมัติเมื่อถึงเวลา — ไม่ต้องมากดเอง พอจบเรื่องค่อยกลับมาติดเหรียญถาวรก็ได้
      </p>
    </Mock>
  );
}

function EarningsBlock() {
  return (
    <Mock label="รายได้ (Dashboard)">
      <div className="flex items-end justify-between">
        <div>
          <p className="text-[10px] uppercase tracking-[0.2em] text-[var(--text-muted)]">รายได้รวม · ส่วนแบ่ง 80%</p>
          <p className="font-bebas text-4xl text-[var(--text-primary)] mt-1">฿ 12,480</p>
        </div>
        <FakeBtn><Wallet className="w-3.5 h-3.5" /> ถอนเงิน</FakeBtn>
      </div>
      <p className="text-[11px] text-[var(--text-muted)] mt-3">
        ทุกครั้งที่คนอ่านปลดล็อกตอนด้วยเหรียญ คุณได้ <span className="text-[var(--text-primary)] font-semibold">80%</span> (แพลตฟอร์มหัก 20% เป็นค่าระบบ) — ถอนเข้าบัญชีได้
      </p>
    </Mock>
  );
}

/* ---------- new pro-toolkit visual blocks ---------- */

function VersionHistoryBlock() {
  return (
    <Mock label="ประวัติเวอร์ชัน (กู้คืนงาน)">
      <div className="space-y-1.5">
        {[
          { d: "วันนี้ 14:32", w: "3,120 คำ", now: true },
          { d: "วันนี้ 11:05", w: "2,740 คำ" },
          { d: "เมื่อวาน 21:18", w: "1,990 คำ" },
        ].map((v) => (
          <div key={v.d} className="flex items-center gap-3 border border-[var(--border)] px-3 py-2 text-xs">
            <History className="w-3.5 h-3.5 text-[var(--text-muted)] shrink-0" />
            <span className="text-[var(--text-primary)]">{v.d}</span>
            <span className="text-[10px] text-[var(--text-muted)]">· {v.w}</span>
            <span className="flex-1" />
            {v.now ? (
              <span className="text-[10px] uppercase tracking-wider text-[var(--text-muted)]">ปัจจุบัน</span>
            ) : (
              <span className="inline-flex items-center gap-2">
                <span className="inline-flex items-center gap-1 text-[10px] text-[var(--text-secondary)] border border-[var(--border)] px-2 py-0.5"><Eye className="w-3 h-3" /> ดู</span>
                <span className="inline-flex items-center gap-1 text-[10px] text-[var(--text-primary)] border border-[var(--border)] px-2 py-0.5"><RotateCcw className="w-3 h-3" /> กู้คืน</span>
              </span>
            )}
          </div>
        ))}
      </div>
    </Mock>
  );
}

function StoryBibleBlock() {
  return (
    <Mock label="Story Bible — คลังข้อมูลเรื่อง">
      <div className="grid sm:grid-cols-2 gap-2">
        {[
          { icon: Users, t: "ตัวละคร", d: "อาริน — นางเอก ผมเงิน ตาสีฟ้า อายุ 17" },
          { icon: MapPin, t: "สถานที่", d: "เมืองเวล — เมืองท่าเหนือ หมอกตลอดปี" },
          { icon: BookOpen, t: "ปูมเรื่อง", d: "กติกาเวท: ใช้พลังได้ 3 ครั้ง/วัน" },
          { icon: Library, t: "ไอเทม/อื่นๆ", d: "ดาบจันทรา — สืบทอดตระกูล" },
        ].map((c) => (
          <div key={c.t} className="border border-[var(--border)] p-3">
            <div className="flex items-center gap-2 mb-1">
              <c.icon className="w-3.5 h-3.5 text-[var(--text-primary)]" />
              <span className="text-xs font-semibold text-[var(--text-primary)]">{c.t}</span>
            </div>
            <p className="text-[11px] text-[var(--text-muted)] leading-relaxed">{c.d}</p>
          </div>
        ))}
      </div>
    </Mock>
  );
}

function AnalyticsBlock() {
  return (
    <Mock label="สถิติรายเรื่อง (Analytics)">
      <div className="grid grid-cols-3 gap-2 mb-3">
        {[
          { k: "ยอดอ่าน", v: "48.2K" },
          { k: "ผู้ติดตาม", v: "1,204" },
          { k: "ปลดล็อก", v: "362" },
        ].map((s) => (
          <div key={s.k} className="border border-[var(--border)] p-2.5 text-center">
            <p className="font-bebas text-2xl text-[var(--text-primary)] leading-none">{s.v}</p>
            <p className="text-[10px] text-[var(--text-muted)] mt-1">{s.k}</p>
          </div>
        ))}
      </div>
      <div className="flex items-end gap-1 h-16 border-b border-[var(--border)] pb-px">
        {[35, 52, 44, 68, 60, 82, 95].map((h, i) => (
          <div key={i} className="flex-1 bg-[var(--text-primary)]/70" style={{ height: `${h}%` }} />
        ))}
      </div>
      <p className="text-[10px] text-[var(--text-muted)] mt-2">ยอดอ่าน 7 วันล่าสุด · ดูได้ว่าตอนไหนปังหรือร่วง เพื่อวางแผนเขียนต่อ</p>
    </Mock>
  );
}

function ExportBlock() {
  return (
    <Mock label="ส่งออกต้นฉบับ (Backup)">
      <div className="flex flex-wrap items-center gap-2">
        <FakeBtn><FileDown className="w-3.5 h-3.5" /> .TXT</FakeBtn>
        <FakeBtn><FileDown className="w-3.5 h-3.5" /> .EPUB</FakeBtn>
        <ArrowRight className="w-4 h-4 text-[var(--text-muted)]" />
        <span className="text-xs text-[var(--text-muted)]">โหลดทั้งเรื่องเก็บไว้ในเครื่อง</span>
      </div>
      <p className="text-[11px] text-[var(--text-muted)] mt-3">
        งานเขียนเป็นของคุณ 100% — ส่งออกเก็บสำรอง หรือเอา .epub ไปอ่านบนเครื่องอ่าน e-book ได้เลย
      </p>
    </Mock>
  );
}

/* ---------- ad banner: new writer toolkit ---------- */

function WriterToolkitBanner() {
  const tools = [
    { icon: Type, t: "เอดิเตอร์ WYSIWYG" },
    { icon: History, t: "ประวัติเวอร์ชัน" },
    { icon: Library, t: "Story Bible" },
    { icon: BarChart3, t: "สถิติรายเรื่อง" },
    { icon: FileDown, t: "ส่งออก .epub" },
    { icon: Maximize2, t: "โหมดโฟกัส" },
  ];
  return (
    <div className="relative overflow-hidden border border-[var(--text-primary)] bg-[var(--bg-card)] p-6 mb-10">
      {/* glow accent */}
      <div className="pointer-events-none absolute -top-16 -right-16 w-48 h-48 rounded-full bg-[var(--text-primary)]/10 blur-2xl" />
      <div className="relative">
        <span className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[0.25em] text-[var(--text-primary)] font-semibold">
          <Sparkles className="w-3.5 h-3.5" /> ใหม่! เครื่องมือนักเขียนระดับโปร
        </span>
        <h2 className="font-bebas text-3xl sm:text-4xl text-[var(--text-primary)] tracking-wide mt-2 leading-none">
          เครื่องมือเขียนครบ จบในที่เดียว
        </h2>
        <p className="text-sm text-[var(--text-secondary)] mt-2 max-w-lg leading-relaxed">
          INKVERSE อัปเกรดชุดเครื่องมือนักเขียนใหม่หมด — เขียนลื่น เก็บงานปลอดภัย วางโครงเรื่องเป็นระบบ
          และดูสถิติเพื่อโตได้จริง สิ่งที่แพลตฟอร์มอื่นไม่มีให้
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-5">
          {tools.map((t) => (
            <div key={t.t} className="flex items-center gap-2.5 border border-[var(--border)] bg-[var(--bg-primary)]/40 px-3 py-2.5">
              <t.icon className="w-4 h-4 text-[var(--text-primary)] shrink-0" />
              <span className="text-xs font-semibold text-[var(--text-primary)]">{t.t}</span>
            </div>
          ))}
        </div>
        <p className="text-[11px] text-[var(--text-muted)] mt-4">เลื่อนลงดูวิธีใช้ทุกตัวแบบทีละขั้น ↓</p>
      </div>
    </div>
  );
}

/* ---------- the page ---------- */

type Role = "writer" | "translator";

export default function Creator101() {
  const [role, setRole] = useState<Role>("writer");

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
      {/* hero */}
      <p className="text-[11px] uppercase tracking-[0.3em] text-[var(--text-muted)]">CREATOR 101</p>
      <h1 className="font-bebas text-5xl sm:text-6xl text-[var(--text-primary)] tracking-wider mt-1">
        สอนสร้างเนื้อหา
      </h1>
      <p className="text-[var(--text-secondary)] text-sm mt-3 leading-relaxed max-w-xl">
        คู่มือทีละขั้นแบบเห็นภาพ — ตั้งแต่สมัคร สร้างเรื่อง ใช้เครื่องมือ ไปจนถึงรับรายได้ เลือกหมวดของคุณด้านล่าง
      </p>

      {/* role tabs */}
      <div className="grid grid-cols-2 gap-3 mt-7">
        {([
          { k: "writer", icon: PenLine, t: "นักเขียน", d: "เขียนนิยาย (ข้อความ)" },
          { k: "translator", icon: Languages, t: "นักแปล", d: "แปลมังงะ/มันฮวา (รูป)" },
        ] as const).map((r) => (
          <button
            key={r.k}
            onClick={() => setRole(r.k)}
            className={clsx(
              "flex items-center gap-3 p-4 border text-left transition-colors",
              role === r.k
                ? "border-[var(--text-primary)] bg-[var(--text-primary)] text-[var(--bg-primary)]"
                : "border-[var(--border)] text-[var(--text-primary)] hover:border-[var(--text-primary)]/50"
            )}
          >
            <r.icon className="w-6 h-6 shrink-0" />
            <div>
              <p className="font-bebas text-xl tracking-wide leading-none">{r.t}</p>
              <p className={clsx("text-[11px] mt-1", role === r.k ? "text-[var(--bg-primary)]/70" : "text-[var(--text-muted)]")}>{r.d}</p>
            </div>
          </button>
        ))}
      </div>

      {/* steps */}
      <div className="mt-10">
        {role === "writer" ? <WriterGuide /> : <TranslatorGuide />}
      </div>

      {/* CTA */}
      <div className="mt-8 border border-[var(--border)] p-6 text-center">
        <p className="font-bebas text-2xl text-[var(--text-primary)] tracking-wide">พร้อมเริ่มแล้ว?</p>
        <p className="text-sm text-[var(--text-secondary)] mt-1 mb-4">ช่วงนี้เปิดรับครีเอเตอร์รุ่นแรก อนุมัติไว</p>
        <Link
          href={role === "writer" ? "/apply?as=writer" : "/apply?as=translator"}
          className="inline-flex items-center gap-2 bal-btn px-6 py-3 text-sm font-semibold uppercase tracking-widest"
        >
          {role === "writer" ? "สมัครเป็นนักเขียน" : "สมัครเป็นนักแปล"}
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    </div>
  );
}

/* ---------- WRITER ---------- */

function WriterGuide() {
  return (
    <>
      <WriterToolkitBanner />

      <Step n={1} title="สมัครเป็นนักเขียน">
        <p>เข้าเมนู <b className="text-[var(--text-primary)]">ครีเอเตอร์ → สมัครนักเขียน</b> กรอกใบสมัครสั้นๆ</p>
        <Mock label="ใบสมัครนักเขียน">
          <div className="flex flex-wrap gap-2">
            <Chip>นามปากกา</Chip><Chip>ประสบการณ์</Chip><Chip>ตัวอย่างงาน</Chip>
            <Chip>ลิงก์โซเชียล</Chip><Chip>แนวที่ถนัด</Chip><Chip>แรงบันดาลใจ</Chip>
          </div>
        </Mock>
        <Tip>ช่วงเปิดรับรุ่นแรกอนุมัติอัตโนมัติ — สมัครเสร็จเป็นนักเขียนทันที (ถ้าเมนูยังไม่ขึ้น ลองออกจากระบบแล้วเข้าใหม่ 1 ครั้ง)</Tip>
      </Step>

      <Step n={2} title="สร้างเรื่องใหม่">
        <p>กดเมนู <b className="text-[var(--text-primary)]">เขียนนิยาย</b> แล้วกรอกข้อมูลเรื่อง จากนั้นเข้าหน้าเขียนตอนทันที</p>
        <Mock label="สร้างนิยาย">
          <div className="space-y-2 text-xs">
            <div className="border border-[var(--border)] px-3 py-2 text-[var(--text-muted)]">ชื่อเรื่อง — เช่น “รักนี้ที่ปลายฟ้า”</div>
            <div className="border border-[var(--border)] px-3 py-2 text-[var(--text-muted)]">เรื่องย่อสั้นๆ…</div>
            <div className="flex flex-wrap gap-2 pt-1">
              <Chip>แฟนตาซี</Chip><Chip>โรแมนซ์</Chip><Chip>+ แท็กเอง #ตัวร้ายกลับใจ</Chip>
            </div>
          </div>
        </Mock>
        <Tip>ใส่ <b className="text-[var(--text-primary)]">แท็กเอง</b> ได้ (เช่น #เกิดใหม่ #ตัวร้าย) นักอ่านชอบค้นเรื่องตามแท็ก = คนเจอเรื่องคุณง่ายขึ้น</Tip>
      </Step>

      <Step n={3} title="เขียนตอนด้วยเครื่องมือเขียน">
        <p>หน้าเขียนตอนมีเครื่องมือครบเหมือนโปรแกรมเขียนมืออาชีพ จัดรูปแบบข้อความได้เต็มที่ — เลือกข้อความแล้วกดปุ่มบนแถบเครื่องมือเพื่อจัดรูปแบบ</p>
        <EditorTools />
        <Tip><b className="text-[var(--text-primary)]">บันทึกอัตโนมัติทุก 2 วินาที</b> — ไม่ต้องกดเซฟเอง เน็ตหลุด/ปิดหน้าไปงานก็ไม่หาย</Tip>
      </Step>

      <Step n={4} title="แทรกรูปในตอน">
        <p>กดปุ่ม <b className="text-[var(--text-primary)]">แทรกรูป</b> ในแถบเครื่องมือ → เลือกไฟล์จากเครื่อง → ระบบอัปขึ้นให้เอง แล้วรูปจะแทรกในเนื้อหา</p>
        <Mock><div className="flex items-center gap-2"><FakeBtn><ImageIcon className="w-3.5 h-3.5" /> แทรกรูป</FakeBtn><ArrowRight className="w-4 h-4 text-[var(--text-muted)]" /><span className="text-xs text-[var(--text-muted)]">เลือกไฟล์ → อัปอัตโนมัติ → แทรกในตอน</span></div></Mock>
      </Step>

      <Step n={5} title="ประวัติเวอร์ชัน — ย้อน & กู้คืนงาน">
        <p>กดไอคอน <b className="text-[var(--text-primary)]">ประวัติเวอร์ชัน</b> <History className="inline w-3.5 h-3.5 align-text-bottom" /> บนแถบเครื่องมือ ระบบเก็บสแน็ปช็อตงานให้เป็นช่วงๆ อัตโนมัติ เผลอลบทั้งย่อหน้า หรืออยากกลับไปเวอร์ชันก่อน — <b className="text-[var(--text-primary)]">กู้คืนได้ในคลิกเดียว</b></p>
        <VersionHistoryBlock />
        <Tip>กด <b className="text-[var(--text-primary)]">ดู</b> เพื่อพรีวิวเวอร์ชันเก่าก่อน แล้วค่อย <b className="text-[var(--text-primary)]">กู้คืน</b> — เวอร์ชันปัจจุบันจะถูกเก็บเข้าประวัติให้ก่อนเสมอ ไม่มีทางพลาด</Tip>
      </Step>

      <Step n={6} title="Story Bible — คลังข้อมูลเรื่อง">
        <p>เปิดจากหน้าจัดการเรื่อง → <b className="text-[var(--text-primary)]">Story Bible</b> ที่เก็บข้อมูลตัวละคร สถานที่ ปูมเรื่อง และกติกาโลก ไว้ที่เดียว เขียนเรื่องยาวหลายร้อยตอนก็ไม่หลุดรายละเอียด ชื่อตัวละคร/สีตาไม่เพี้ยน</p>
        <StoryBibleBlock />
        <Tip>เหมาะมากกับนิยายแฟนตาซี/ระบบเวท ที่มีตัวละครเยอะ — เปิดอ่านอ้างอิงระหว่างเขียนได้ตลอด ไม่ต้องเลื่อนหาในตอนเก่า</Tip>
      </Step>

      <Step n={7} title="บันทึกร่าง · เผยแพร่ · ตั้งเวลาโพสต์">
        <Mock>
          <div className="flex flex-wrap gap-2">
            <FakeBtn><Save className="w-3.5 h-3.5" /> บันทึกร่าง</FakeBtn>
            <FakeBtn solid><Send className="w-3.5 h-3.5" /> เผยแพร่</FakeBtn>
            <FakeBtn><Clock className="w-3.5 h-3.5" /> ตั้งเวลาโพสต์</FakeBtn>
          </div>
        </Mock>
        <p><b className="text-[var(--text-primary)]">ร่าง</b> = เก็บไว้ ยังไม่โชว์ · <b className="text-[var(--text-primary)]">เผยแพร่</b> = ขึ้นทันที + แจ้งเตือนคนติดตาม · <b className="text-[var(--text-primary)]">ตั้งเวลา</b> = ตั้งให้ขึ้นเองในอนาคต</p>
      </Step>

      <Step n={8} title="ตั้งตอนพรีเมียม / อ่านล่วงหน้า">
        <p>หาเงินจากตอนของคุณ — ตั้งราคาเหรียญต่อตอน หรือทำ “อ่านล่วงหน้า” (ติดเหรียญช่วงแรก แล้วปลดฟรีตามเวลา)</p>
        <MonetizeBlock />
      </Step>

      <Step n={9} title="ดูสถิติรายเรื่อง (Analytics)">
        <p>เปิดจากหน้าจัดการเรื่อง → <b className="text-[var(--text-primary)]">สถิติ</b> ดูยอดอ่าน ผู้ติดตาม การปลดล็อก และกราฟย้อนหลัง รู้ว่าตอนไหนคนชอบ จะได้เขียนต่อให้ตรงใจคนอ่าน</p>
        <AnalyticsBlock />
      </Step>

      <Step n={10} title="ส่งออกต้นฉบับ (.txt / .epub)">
        <p>กด <b className="text-[var(--text-primary)]">ส่งออก</b> เพื่อโหลดทั้งเรื่องเก็บไว้ในเครื่อง เป็นไฟล์ <b className="text-[var(--text-primary)]">.txt</b> หรือ <b className="text-[var(--text-primary)]">.epub</b> (e-book) — สำรองงานหรือเอาไปอ่าน/แก้ที่อื่นได้</p>
        <ExportBlock />
        <Tip>นิสัยดี: ส่งออกเก็บไว้เป็นระยะ งานเขียนคือทรัพย์สินของคุณ มีสำเนาของตัวเองอุ่นใจกว่า</Tip>
      </Step>

      <Step n={11} title="รับรายได้ + ถอนเงิน" last>
        <EarningsBlock />
      </Step>
    </>
  );
}

/* ---------- TRANSLATOR ---------- */

function TranslatorGuide() {
  return (
    <>
      <Step n={1} title="สมัครเป็นนักแปล">
        <p>เข้าเมนู <b className="text-[var(--text-primary)]">ครีเอเตอร์ → สมัครนักแปล</b> กรอกใบสมัครสั้นๆ</p>
        <Mock label="ใบสมัครนักแปล">
          <div className="flex flex-wrap gap-2">
            <Chip>ชื่อทีม/นามแฝง</Chip><Chip>ประสบการณ์แปล</Chip><Chip>ตัวอย่างงาน</Chip>
            <Chip>ลิงก์โซเชียล</Chip><Chip>แนวที่ถนัด</Chip>
          </div>
        </Mock>
        <Tip>โปรดแปลเฉพาะผลงานที่มีสิทธิ์/ได้รับอนุญาต เพื่อความปลอดภัยของคุณและเว็บ</Tip>
      </Step>

      <Step n={2} title="อัปโหลดเรื่องใหม่">
        <p>ไปหน้า <b className="text-[var(--text-primary)]">อัปโหลด</b> กรอกข้อมูลเรื่อง + อัปปก</p>
        <Mock label="สร้างเรื่อง (มังงะ/มันฮวา/มันฮัว)">
          <div className="flex gap-3">
            <div className="w-16 h-24 border border-dashed border-[var(--border)] flex items-center justify-center text-[10px] text-[var(--text-muted)] text-center shrink-0 px-1">อัปปก</div>
            <div className="space-y-2 text-xs flex-1">
              <div className="border border-[var(--border)] px-3 py-1.5 text-[var(--text-muted)]">ชื่อเรื่อง</div>
              <div className="flex gap-2">
                <Chip>ประเภท: MANHWA</Chip><Chip>ต้นทาง: KR</Chip>
              </div>
              <div className="flex flex-wrap gap-2"><Chip>แอ็คชัน</Chip><Chip>แฟนตาซี</Chip></div>
            </div>
          </div>
        </Mock>
        <Tip>ตั้ง <b className="text-[var(--text-primary)]">ประเภท</b> ให้ถูก (MANGA/MANHWA/MANHUA) เรื่องจะไปอยู่ในหมวดที่ใช่ คนหาเจอง่าย</Tip>
      </Step>

      <Step n={3} title="เพิ่มตอน + อัปรูปหน้า">
        <p>กด <b className="text-[var(--text-primary)]">เพิ่มตอน</b> แล้วอัปรูปหน้ามังงะทีละหลายรูป — ระบบเรียงตามลำดับให้</p>
        <Mock label="อัปโหลดหน้าของตอน">
          <div className="flex items-center gap-3">
            <FakeBtn><Upload className="w-3.5 h-3.5" /> อัปรูปหน้า</FakeBtn>
            <div className="flex gap-1.5">
              {[1,2,3,4].map((i)=>(
                <div key={i} className="w-8 h-10 border border-[var(--border)] flex items-center justify-center text-[10px] text-[var(--text-muted)]">{i}</div>
              ))}
              <div className="w-8 h-10 border border-dashed border-[var(--border)] flex items-center justify-center text-[var(--text-muted)]">+</div>
            </div>
          </div>
        </Mock>
      </Step>

      <Step n={4} title="จัดการตอน (เรียง / แก้ / ลบ)">
        <p>ในหน้าจัดการตอน ลากเรียงลำดับ แก้ไข หรือลบได้ พร้อมเห็นสถานะแต่ละตอน</p>
        <Mock label="ตัวจัดการตอน">
          <div className="space-y-1.5">
            {[
              { n: "ตอนที่ 12", s: "เผยแพร่" },
              { n: "ตอนที่ 13", s: "ตั้งเวลา" },
              { n: "ตอนที่ 14", s: "ร่าง" },
            ].map((c) => (
              <div key={c.n} className="flex items-center gap-3 border border-[var(--border)] px-3 py-2 text-xs">
                <GripVertical className="w-4 h-4 text-[var(--text-muted)]" />
                <span className="text-[var(--text-primary)] flex-1">{c.n}</span>
                <span className="text-[10px] uppercase tracking-wider text-[var(--text-muted)] border border-[var(--border)] px-2 py-0.5">{c.s}</span>
              </div>
            ))}
          </div>
        </Mock>
      </Step>

      <Step n={5} title="ตั้งตอนพรีเมียม / อ่านล่วงหน้า">
        <p>ตั้งราคาเหรียญต่อตอน หรือทำ “อ่านล่วงหน้า” เหมือนกับนักเขียน — กลไกเดียวกัน</p>
        <MonetizeBlock />
      </Step>

      <Step n={6} title="รับรายได้ + ถอนเงิน">
        <EarningsBlock />
      </Step>

      <Step n={7} title="โปรโมทเรื่องของคุณ" last>
        <p>ในแดชบอร์ดมี <b className="text-[var(--text-primary)]">ชุดโปรโมท</b> — ลิงก์เชิญเพื่อน + รูป/แคปชันพร้อมแชร์ ดึงคนเข้ามาอ่านเรื่องคุณ</p>
        <Mock><div className="flex items-center gap-2"><FakeBtn><Megaphone className="w-3.5 h-3.5" /> ชุดโปรโมท</FakeBtn><BadgeCheck className="w-4 h-4 text-[var(--text-muted)]" /><span className="text-xs text-[var(--text-muted)]">ลิงก์เชิญ + รูปแชร์พร้อมใช้</span></div></Mock>
      </Step>
    </>
  );
}
