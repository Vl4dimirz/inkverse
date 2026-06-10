"use client";

import { useState, useRef, useEffect } from "react";
import { MessageCircle, X, Send, Bot } from "lucide-react";

interface Faq {
  topic: string;
  keywords: string[];
  answer: string;
  link?: { href: string; label: string };
}

// Knowledge base — covers the common "how do I…" questions on the site.
const FAQS: Faq[] = [
  {
    topic: "เติมเหรียญ / ซื้อ Coin",
    keywords: ["เติม", "เหรียญ", "coin", "เงิน", "topup", "ซื้อ", "เติมเงิน", "ราคา", "แพ็ก", "แพ็กเกจ"],
    answer:
      "เติมเหรียญได้ที่หน้า เติมเหรียญ — เลือกแพ็กเกจ แล้วชำระผ่าน PromptPay (สแกน QR ด้วยแอปธนาคาร แล้วอัปโหลดสลิป ระบบตรวจอัตโนมัติ) อัตรา 1 เหรียญ = 1 บาท",
    link: { href: "/topup", label: "ไปหน้าเติมเหรียญ" },
  },
  {
    topic: "ปลดล็อกตอน Premium",
    keywords: ["ปลดล็อก", "premium", "พรีเมียม", "อ่านตอน", "ล็อก", "เสียเงิน", "ตอนเสียเงิน", "unlock"],
    answer:
      "ตอน Premium ใช้เหรียญปลดล็อก — กดที่ตอนแล้วยืนยัน หรือใช้ปุ่ม 'ปลดล็อกหลายตอน' ที่หน้าเรื่องเพื่อปลดหลายตอนพร้อมกัน (เลือกจำนวนได้) เมื่อปลดแล้วอ่านได้ตลอด",
  },
  {
    topic: "สลิป/ชำระเงินไม่ผ่าน",
    keywords: ["สลิป", "ชำระ", "จ่ายเงิน", "ไม่ผ่าน", "เติมไม่เข้า", "promptpay", "qr", "ตรวจสลิป", "โอนแล้ว"],
    answer:
      "ระบบตรวจสลิปอัตโนมัติ ต้องแน่ใจว่า: (1) ยอดโอน 'ตรงเป๊ะ' กับราคาแพ็ก (2) โอนเข้าบัญชีปลายทางที่ถูกต้อง (3) อัปสลิปฉบับเต็มที่เห็น QR ชัด ถ้ายังไม่เข้าให้ลองอัปใหม่ หรือติดต่อแอดมิน",
    link: { href: "/topup", label: "ลองเติมใหม่" },
  },
  {
    topic: "สมัครเป็นนักแปล",
    keywords: ["สมัคร", "นักแปล", "แปล", "translator", "เป็นนักแปล", "ลงผลงาน", "อยากแปล"],
    answer:
      "สมัครเป็นนักแปลได้ที่หน้า สมัครนักแปล — กรอกฟอร์ม 3 ขั้น และยอมรับเงื่อนไข (ส่วนแบ่งรายได้: นักแปลได้ 80% แพลตฟอร์มหัก 20%) ทีมงานตรวจและแจ้งผลภายใน 3-5 วัน",
    link: { href: "/apply", label: "ไปหน้าสมัครนักแปล" },
  },
  {
    topic: "อัปโหลดผลงาน / เพิ่มตอน",
    keywords: ["อัปโหลด", "อัพโหลด", "upload", "เพิ่มตอน", "ลงตอน", "สร้างมังงะ", "ลงเรื่อง"],
    answer:
      "ต้องเป็นนักแปลที่ได้รับอนุมัติก่อนถึงจะอัปโหลดได้ เมื่ออนุมัติแล้วไปหน้า อัปโหลดผลงาน — สร้างมังงะใหม่ในแท็บ 'มังงะ' จากนั้นสลับไปแท็บ 'ตอน' เพื่อเพิ่มตอน",
    link: { href: "/upload", label: "ไปหน้าอัปโหลด" },
  },
  {
    topic: "ถอนเงิน (นักแปล)",
    keywords: ["ถอน", "ถอนเงิน", "รายได้", "withdraw", "เงินเข้า", "earning", "payout"],
    answer:
      "นักแปลถอนรายได้สะสมได้ที่ แดชบอร์ด > ถอนเงิน เมื่อถึงยอดขั้นต่ำที่กำหนด ดูรายได้ที่หน้า รายได้ ในแดชบอร์ด",
    link: { href: "/dashboard/withdraw", label: "ไปหน้าถอนเงิน" },
  },
  {
    topic: "บุ๊กมาร์ก / ติดตามเรื่อง",
    keywords: ["บุ๊กมาร์ก", "ติดตาม", "favorite", "bookmark", "เก็บเรื่อง", "หัวใจ"],
    answer:
      "กดปุ่มบุ๊กมาร์ก (รูปหัวใจ) ที่หน้าเรื่องเพื่อเก็บไว้อ่านภายหลัง และดูเรื่องที่อ่านค้างได้ที่แถบ 'อ่านต่อ' หน้าแรก",
  },
  {
    topic: "เข้าสู่ระบบ / สมัครสมาชิก",
    keywords: ["login", "เข้าสู่ระบบ", "สมัครสมาชิก", "register", "บัญชี", "google", "รหัสผ่าน", "ล็อกอิน"],
    answer:
      "สมัคร/เข้าสู่ระบบด้วยอีเมล+รหัสผ่าน หรือเข้าสู่ระบบด้วย Google ได้ที่หน้าเข้าสู่ระบบ",
    link: { href: "/auth/signin", label: "เข้าสู่ระบบ" },
  },
];

const GREETING =
  "สวัสดีครับ 👋 ผมเป็นผู้ช่วยของ INKVERSE ถามเรื่องการใช้งานเว็บได้เลย เช่น เติมเหรียญ ปลดล็อกตอน สมัครนักแปล หรือเลือกหัวข้อด้านล่าง";

interface Msg { from: "bot" | "user"; text: string; link?: Faq["link"] }

function findAnswer(input: string): Faq | null {
  const q = input.toLowerCase();
  let best: { faq: Faq; score: number } | null = null;
  for (const faq of FAQS) {
    const score = faq.keywords.reduce((s, k) => (q.includes(k.toLowerCase()) ? s + 1 : s), 0);
    if (score > 0 && (!best || score > best.score)) best = { faq, score };
  }
  return best?.faq ?? null;
}

export default function HelpChatbot() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [msgs, setMsgs] = useState<Msg[]>([{ from: "bot", text: GREETING }]);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs, open]);

  function ask(text: string) {
    const t = text.trim();
    if (!t) return;
    const faq = findAnswer(t);
    setMsgs((m) => [
      ...m,
      { from: "user", text: t },
      faq
        ? { from: "bot", text: faq.answer, link: faq.link }
        : { from: "bot", text: "ขออภัย ผมยังไม่เข้าใจคำถามนี้ ลองเลือกหัวข้อด้านล่าง หรือพิมพ์คำสำคัญ เช่น 'เติมเหรียญ', 'ปลดล็อก', 'สมัครนักแปล'" },
    ]);
    setInput("");
  }

  return (
    <>
      {/* Launcher */}
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="ช่วยเหลือ"
        className="fixed bottom-5 right-5 z-50 w-14 h-14 rounded-full bg-[var(--text-primary)] text-[var(--bg-primary)] shadow-lg flex items-center justify-center hover:opacity-90 transition-opacity"
      >
        {open ? <X className="w-6 h-6" /> : <MessageCircle className="w-6 h-6" />}
      </button>

      {/* Panel */}
      {open && (
        <div className="fixed bottom-24 right-5 z-50 w-[min(92vw,360px)] h-[min(70vh,520px)] flex flex-col rounded-2xl bg-[var(--bg-surface)] border border-[var(--border)] shadow-2xl overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 bg-[var(--accent)]">
            <Bot className="w-5 h-5 text-[var(--text-primary)]" />
            <span className="text-[var(--text-primary)] font-semibold text-sm">ผู้ช่วย INKVERSE</span>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-3 scrollbar-none">
            {msgs.map((m, i) => (
              <div key={i} className={m.from === "user" ? "flex justify-end" : "flex justify-start"}>
                <div
                  className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-relaxed ${
                    m.from === "user"
                      ? "bg-[var(--text-primary)] text-[var(--text-primary)] rounded-br-sm"
                      : "bg-[var(--bg-card)] text-gray-200 rounded-bl-sm"
                  }`}
                >
                  {m.text}
                  {m.link && (
                    <a href={m.link.href} className="block mt-2 text-[var(--text-primary)] font-medium hover:underline">
                      → {m.link.label}
                    </a>
                  )}
                </div>
              </div>
            ))}

            {/* Topic quick-replies (show after greeting only) */}
            {msgs.length === 1 && (
              <div className="flex flex-wrap gap-2 pt-1">
                {FAQS.slice(0, 5).map((f) => (
                  <button
                    key={f.topic}
                    onClick={() => ask(f.topic)}
                    className="text-xs px-2.5 py-1.5 rounded-lg bg-[var(--bg-card)] border border-[var(--border)] text-[var(--text-primary)] hover:border-[var(--text-primary)]/40 hover:text-[var(--text-primary)] transition-colors"
                  >
                    {f.topic}
                  </button>
                ))}
              </div>
            )}
            <div ref={endRef} />
          </div>

          <form
            onSubmit={(e) => { e.preventDefault(); ask(input); }}
            className="flex items-center gap-2 p-2.5 border-t border-[var(--border)] bg-[var(--bg-surface)]"
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="พิมพ์คำถาม..."
              className="flex-1 bg-[var(--bg-card)] border border-[var(--border)] rounded-xl px-3 py-2 text-sm text-[var(--text-primary)] placeholder-gray-500 focus:outline-none focus:border-[var(--text-primary)]/50"
            />
            <button
              type="submit"
              className="w-9 h-9 rounded-xl bg-[var(--text-primary)] text-[var(--bg-primary)] flex items-center justify-center shrink-0 hover:opacity-90"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      )}
    </>
  );
}
