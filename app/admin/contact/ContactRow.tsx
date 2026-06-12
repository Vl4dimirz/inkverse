"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, RotateCcw, Reply, Send } from "lucide-react";

interface Msg {
  id: string;
  name: string;
  email: string;
  subject: string | null;
  message: string;
  status: string;
  createdAt: string;
  username: string | null;
  reply: string | null;
  repliedAt: string | null;
}

export default function ContactRow({ msg }: { msg: Msg }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [note, setNote] = useState("");
  const resolved = msg.status === "RESOLVED";

  async function toggle() {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/contact/${msg.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: resolved ? "OPEN" : "RESOLVED" }),
      });
      if (res.ok) router.refresh();
    } finally {
      setLoading(false);
    }
  }

  async function sendReply() {
    if (!text.trim() || loading) return;
    setLoading(true);
    setNote("");
    try {
      const res = await fetch(`/api/admin/contact/${msg.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reply: text.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        if (data.emailed === false) {
          setNote("บันทึกคำตอบแล้ว แต่ส่งอีเมลไม่สำเร็จ (ยังไม่ได้ตั้งค่า RESEND_API_KEY?)");
          router.refresh();
        } else {
          setOpen(false);
          setText("");
          router.refresh();
        }
      } else {
        setNote(data.error || "ส่งไม่สำเร็จ");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={`border border-[var(--border)] p-4 ${resolved ? "bg-[var(--bg-card)] opacity-80" : "bg-[var(--bg-surface)]"}`}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-[var(--text-primary)]">{msg.name}</span>
            {msg.username && <span className="text-xs text-[var(--text-secondary)]">@{msg.username}</span>}
            <span className="text-xs text-[var(--text-secondary)]">· {msg.email}</span>
          </div>
          {msg.subject && (
            <p className="text-sm text-[var(--text-primary)] mt-1.5 font-medium">{msg.subject}</p>
          )}
          <p className="text-sm text-[var(--text-secondary)] mt-1 whitespace-pre-wrap break-words">{msg.message}</p>
          <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-widest mt-2">
            {new Date(msg.createdAt).toLocaleString("th-TH")}
          </p>
        </div>
        <button
          onClick={toggle}
          disabled={loading}
          className="shrink-0 inline-flex items-center gap-1.5 border border-[var(--border)] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-[var(--text-primary)] hover:bg-[var(--text-primary)] hover:text-[var(--bg-primary)] transition-colors disabled:opacity-50"
        >
          {loading ? (
            <Loader2 className="w-3 h-3 animate-spin" />
          ) : resolved ? (
            <RotateCcw className="w-3 h-3" />
          ) : (
            <Check className="w-3 h-3" />
          )}
          {resolved ? "เปิดใหม่" : "เสร็จสิ้น"}
        </button>
      </div>

      {/* Existing reply (already answered) */}
      {msg.reply && (
        <div className="mt-3 border-l-2 border-[var(--text-primary)] pl-3">
          <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-widest">
            ตอบแล้ว{msg.repliedAt ? ` · ${new Date(msg.repliedAt).toLocaleString("th-TH")}` : ""}
          </p>
          <p className="text-sm text-[var(--text-primary)] mt-1 whitespace-pre-wrap break-words">{msg.reply}</p>
        </div>
      )}

      {/* Reply composer */}
      <div className="mt-3">
        {!open ? (
          <button
            onClick={() => setOpen(true)}
            className="inline-flex items-center gap-1.5 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
          >
            <Reply className="w-3.5 h-3.5" />
            {msg.reply ? "ตอบกลับอีกครั้ง" : "ตอบกลับทางอีเมล"}
          </button>
        ) : (
          <div className="space-y-2">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={3}
              autoFocus
              placeholder={`พิมพ์คำตอบถึง ${msg.name}... (จะส่งไปที่ ${msg.email})`}
              className="w-full bg-[var(--bg-card)] border border-[var(--border)] p-2.5 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--text-primary)]/60 resize-y"
              maxLength={5000}
            />
            {note && <p className="text-xs text-[var(--text-primary)]">{note}</p>}
            <div className="flex items-center gap-2">
              <button
                onClick={sendReply}
                disabled={loading || !text.trim()}
                className="inline-flex items-center gap-1.5 bal-btn px-4 py-2 text-xs font-semibold uppercase tracking-widest disabled:opacity-50"
              >
                {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                ส่งคำตอบ
              </button>
              <button
                onClick={() => { setOpen(false); setNote(""); }}
                disabled={loading}
                className="text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
              >
                ยกเลิก
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
