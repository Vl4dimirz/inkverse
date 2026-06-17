"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import TextAlign from "@tiptap/extension-text-align";
import Placeholder from "@tiptap/extension-placeholder";
import CharacterCount from "@tiptap/extension-character-count";
import {
  Bold, Italic, Underline as UnderlineIcon, Strikethrough, Heading2, Heading3,
  List, ListOrdered, Quote, Minus, Link2, ImagePlus, AlignLeft, AlignCenter, AlignRight,
  Undo2, Redo2, Maximize2, Search, Save, Send, Clock, Loader2, Coins, Target, X,
  History, RotateCcw, Eye,
} from "lucide-react";

interface Existing {
  id: string;
  chapterNum: number;
  title: string | null;
  content: string | null;
  isPremium: boolean;
  coinCost: number;
  status: string;
  publishAt: string | null;
  authorNote: string | null;
  freeAt: string | null;
}

type SaveState = "idle" | "saving" | "saved" | "error";

export default function NovelEditor({
  mangaSlug, suggestedNum, existing,
}: { mangaSlug: string; suggestedNum: number; existing?: Existing | null }) {
  const router = useRouter();
  const [chapterId, setChapterId] = useState<string | null>(existing?.id ?? null);
  const [title, setTitle] = useState(existing?.title ?? "");
  const [num, setNum] = useState(String(existing?.chapterNum ?? suggestedNum));
  const [isPremium, setIsPremium] = useState(existing?.isPremium ?? false);
  const [coinCost, setCoinCost] = useState(String(existing?.coinCost || 5));
  const [earlyDays, setEarlyDays] = useState(() => {
    if (!existing?.freeAt) return "";
    const ms = new Date(existing.freeAt).getTime() - Date.now();
    return ms > 0 ? String(Math.max(1, Math.round(ms / 86400000))) : "";
  });
  const [authorNote, setAuthorNote] = useState(existing?.authorNote ?? "");
  const [status, setStatus] = useState(existing?.status ?? "DRAFT");
  const [scheduleAt, setScheduleAt] = useState(existing?.publishAt ? existing.publishAt.slice(0, 16) : "");
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [error, setError] = useState("");
  const [focus, setFocus] = useState(false);
  const [goal, setGoal] = useState(0);
  const [showFind, setShowFind] = useState(false);
  const [uploadingImg, setUploadingImg] = useState(false);
  const [findText, setFindText] = useState("");
  const [replaceText, setReplaceText] = useState("");
  const [showHistory, setShowHistory] = useState(false);
  const [revisions, setRevisions] = useState<{ id: string; title: string | null; words: number; createdAt: string }[]>([]);
  const [revsLoading, setRevsLoading] = useState(false);
  const [previewRev, setPreviewRev] = useState<{ id: string; title: string | null; content: string | null; createdAt: string } | null>(null);
  const [restoring, setRestoring] = useState(false);
  const [, force] = useState(0);

  const fileRef = useRef<HTMLInputElement>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Re-rendering the whole editor on every keystroke makes the page jump/scroll
  // on mobile. Throttle the toolbar/word-count refresh to ~5×/sec instead.
  const forceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scheduleForce = useCallback(() => {
    if (forceTimer.current) return;
    forceTimer.current = setTimeout(() => { forceTimer.current = null; force((n) => n + 1); }, 200);
  }, []);
  // Latest field values for the debounced autosave closure.
  const stateRef = useRef({ chapterId, title, num, isPremium, coinCost, authorNote, status });
  stateRef.current = { chapterId, title, num, isPremium, coinCost, authorNote, status };
  // The created chapter id, tracked synchronously so back-to-back saves never
  // race into a second CREATE (which would 409 on the unique chapterNum).
  const chapterIdRef = useRef<string | null>(existing?.id ?? null);
  // Serializes overlapping saves so a debounced autosave + an explicit publish
  // run in order (create first, then patch) instead of both trying to create.
  const inFlight = useRef<Promise<boolean> | null>(null);

  // Don't let a debounced autosave fire after the editor unmounts (e.g. right
  // after publish navigates away) — it could re-create or downgrade the chapter.
  useEffect(() => () => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    if (forceTimer.current) clearTimeout(forceTimer.current);
  }, []);

  useEffect(() => {
    try { const g = localStorage.getItem("novelWordGoal"); if (g) setGoal(parseInt(g) || 0); } catch {}
  }, []);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({ heading: { levels: [2, 3] } }),
      Image,
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Placeholder.configure({ placeholder: "เริ่มเขียนเรื่องของคุณ... (เลือกข้อความแล้วกดปุ่มด้านบนเพื่อจัดรูปแบบ)" }),
      CharacterCount,
    ],
    content: existing?.content ?? "",
    onUpdate: () => { scheduleForce(); scheduleSave(); },
    onSelectionUpdate: () => scheduleForce(),
  });

  // ── Save (create-or-patch) ───────────────────────────────────
  const doSave = useCallback(
    async (override?: { status?: string; publishAt?: string | null; freeAt?: string | null }): Promise<boolean> => {
      if (!editor) return false;
      // An explicit save/publish supersedes any pending debounced autosave.
      if (saveTimer.current) { clearTimeout(saveTimer.current); saveTimer.current = null; }
      // If a save is already running, wait for it so we PATCH the (now-created)
      // chapter instead of firing a second CREATE that collides on chapterNum.
      if (inFlight.current) { try { await inFlight.current; } catch {} }

      const run = async (): Promise<boolean> => {
        const st = stateRef.current;
        const n = parseFloat(st.num);
        if (!Number.isFinite(n) || n < 0) { setSaveState("error"); setError("เลขตอนไม่ถูกต้อง"); return false; }
        setSaveState("saving"); setError("");
        const payload = {
          title: st.title.trim(),
          content: editor.getHTML(),
          isPremium: st.isPremium,
          coinCost: st.isPremium ? Math.max(1, parseInt(st.coinCost) || 1) : 0,
          authorNote: st.authorNote.trim(),
          // A bare autosave must never downgrade an already-published chapter.
          status: override?.status ?? st.status ?? "DRAFT",
          publishAt: override?.publishAt ?? null,
          ...(override?.freeAt !== undefined ? { freeAt: override.freeAt } : {}),
        };
        try {
          let res: Response;
          const cid = chapterIdRef.current;
          if (cid) {
            res = await fetch(`/api/chapters/${cid}`, {
              method: "PATCH", headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ ...payload, chapterNum: n }),
            });
          } else {
            res = await fetch(`/api/manga/${mangaSlug}/chapters`, {
              method: "POST", headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ chapterNum: n, ...payload }),
            });
          }
          if (!res.ok) {
            const d = await res.json().catch(() => ({}));
            setSaveState("error"); setError(d.error || "บันทึกไม่สำเร็จ"); return false;
          }
          const saved = await res.json();
          if (saved?.id && !chapterIdRef.current) { chapterIdRef.current = saved.id; setChapterId(saved.id); }
          if (override?.status) setStatus(override.status);
          setSaveState("saved");
          return true;
        } catch {
          setSaveState("error"); setError("เครือข่ายขัดข้อง"); return false;
        }
      };

      const p = run();
      inFlight.current = p;
      try { return await p; } finally { if (inFlight.current === p) inFlight.current = null; }
    },
    [editor, mangaSlug]
  );

  function scheduleSave() {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => doSave(), 2000);
  }

  function computeFreeAt(baseMs: number): string | null {
    const d = isPremium && earlyDays && Number(earlyDays) > 0 ? Number(earlyDays) : 0;
    return d > 0 ? new Date(baseMs + d * 86400000).toISOString() : null;
  }
  async function publish() {
    const ok = await doSave({ status: "PUBLISHED", publishAt: null, freeAt: computeFreeAt(Date.now()) });
    if (ok) { router.push(`/dashboard/manga/${mangaSlug}/chapters`); router.refresh(); }
  }
  async function schedule() {
    if (!scheduleAt) { setError("เลือกวันเวลาก่อน"); return; }
    const base = new Date(scheduleAt);
    const ok = await doSave({ status: "PUBLISHED", publishAt: base.toISOString(), freeAt: computeFreeAt(base.getTime()) });
    if (ok) { router.push(`/dashboard/manga/${mangaSlug}/chapters`); router.refresh(); }
  }

  // ── Image upload ─────────────────────────────────────────────
  async function onPickImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !editor) return;
    // Phones sometimes report an empty or non-image type — fall back to jpeg.
    if (file.size > 8 * 1024 * 1024) { setError("รูปใหญ่เกินไป (สูงสุด 8MB)"); return; }
    setUploadingImg(true);
    setError("");
    try {
      // Upload through our API (server → R2) so it never depends on R2 CORS.
      const fd = new FormData();
      fd.append("file", file);
      fd.append("mangaSlug", mangaSlug);
      const r = await fetch("/api/upload/novel-image", { method: "POST", body: fd });
      const d = await r.json().catch(() => ({}));
      if (!r.ok || !d.url) {
        setError(d.error || "อัปโหลดรูปไม่สำเร็จ");
        return;
      }
      editor.chain().focus().setImage({ src: d.url }).run();
    } catch {
      setError("อัปโหลดรูปไม่สำเร็จ — เครือข่ายขัดข้อง");
    } finally {
      setUploadingImg(false);
    }
  }

  function addLink() {
    if (!editor) return;
    const url = window.prompt("ใส่ลิงก์ (URL):", "https://");
    if (url === null) return;
    if (url === "") editor.chain().focus().extendMarkRange("link").unsetLink().run();
    else editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  }

  function replaceAll() {
    if (!editor || !findText) return;
    const ranges: { from: number; to: number }[] = [];
    editor.state.doc.descendants((node, pos) => {
      if (node.isText && node.text) {
        let i = node.text.indexOf(findText);
        while (i !== -1) { ranges.push({ from: pos + i, to: pos + i + findText.length }); i = node.text.indexOf(findText, i + findText.length); }
      }
    });
    if (!ranges.length) { setError("ไม่พบข้อความ"); return; }
    let chain = editor.chain();
    ranges.sort((a, b) => b.from - a.from).forEach((r) => { chain = chain.insertContentAt({ from: r.from, to: r.to }, replaceText); });
    chain.run();
  }

  // ── Version history ──────────────────────────────────────────
  async function openHistory() {
    setShowHistory(true);
    const cid = stateRef.current.chapterId;
    if (!cid) return;
    setRevsLoading(true);
    try {
      const res = await fetch(`/api/chapters/${cid}/revisions`);
      if (res.ok) setRevisions(await res.json());
    } catch {} finally { setRevsLoading(false); }
  }
  async function previewRevision(revId: string) {
    const cid = stateRef.current.chapterId;
    if (!cid) return;
    try {
      const res = await fetch(`/api/chapters/${cid}/revisions/${revId}`);
      if (res.ok) setPreviewRev(await res.json());
    } catch {}
  }
  async function restoreRevision(revId: string) {
    const cid = stateRef.current.chapterId;
    if (!cid || !editor) return;
    if (!confirm("กู้คืนเวอร์ชันนี้? เวอร์ชันปัจจุบันจะถูกบันทึกไว้ในประวัติก่อน")) return;
    setRestoring(true);
    setError("");
    try {
      const res = await fetch(`/api/chapters/${cid}/revisions/${revId}/restore`, { method: "POST" });
      if (!res.ok) throw new Error();
      const d = await res.json();
      editor.commands.setContent(d.content || "");
      setTitle(d.title ?? "");
      setAuthorNote(d.authorNote ?? "");
      setPreviewRev(null);
      setSaveState("saved");
      await openHistory();
    } catch {
      setError("กู้คืนไม่สำเร็จ");
    } finally { setRestoring(false); }
  }
  const fmtDate = (s: string) =>
    new Date(s).toLocaleString("th-TH", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

  const words = editor?.storage.characterCount.words() ?? 0;
  const chars = editor?.storage.characterCount.characters() ?? 0;

  const tb = "w-8 h-8 flex items-center justify-center border border-[var(--border)] hover:bg-[var(--bg-card)] text-[var(--text-primary)] disabled:opacity-30";
  const active = (on: boolean) => (on ? "bg-[var(--text-primary)] text-[var(--bg-primary)] border-[var(--text-primary)]" : "");
  const e = editor;

  return (
    <div className={focus ? "fixed inset-0 z-50 bg-[var(--bg-primary)] overflow-auto" : "max-w-3xl mx-auto px-4 sm:px-6 py-6"}>
      <div className={focus ? "max-w-3xl mx-auto px-4 pt-16 pb-6" : ""}>
        {!focus && <p className="eyebrow text-[var(--text-secondary)]">{existing ? "แก้ไขตอน" : "เขียนตอนใหม่"}</p>}

        {/* meta */}
        {!focus && (
          <div className="flex flex-wrap items-end gap-4 mb-4">
            <label className="text-sm">
              <span className="block text-xs text-[var(--text-secondary)] uppercase tracking-wide mb-1">เลขตอน</span>
              <input value={num} onChange={(ev) => setNum(ev.target.value)} type="number" step="0.5" min="0" className="w-24 bg-[var(--bg-card)] border border-[var(--border)] px-3 py-2 text-[var(--text-primary)]" />
            </label>
            <label className="text-sm flex-1 min-w-[200px]">
              <span className="block text-xs text-[var(--text-secondary)] uppercase tracking-wide mb-1">ชื่อตอน</span>
              <input value={title} onChange={(ev) => setTitle(ev.target.value)} placeholder="(ไม่บังคับ)" className="w-full bg-[var(--bg-card)] border border-[var(--border)] px-3 py-2 text-[var(--text-primary)]" />
            </label>
          </div>
        )}

        {/* toolbar */}
        <div className="flex flex-wrap gap-1 mb-2 sm:sticky sm:top-0 bg-[var(--bg-primary)] py-1 z-10">
          <button onClick={() => e?.chain().focus().toggleBold().run()} className={`${tb} ${active(!!e?.isActive("bold"))}`} title="หนา"><Bold className="w-4 h-4" /></button>
          <button onClick={() => e?.chain().focus().toggleItalic().run()} className={`${tb} ${active(!!e?.isActive("italic"))}`} title="เอียง"><Italic className="w-4 h-4" /></button>
          <button onClick={() => e?.chain().focus().toggleUnderline().run()} className={`${tb} ${active(!!e?.isActive("underline"))}`} title="ขีดเส้นใต้"><UnderlineIcon className="w-4 h-4" /></button>
          <button onClick={() => e?.chain().focus().toggleStrike().run()} className={`${tb} ${active(!!e?.isActive("strike"))}`} title="ขีดฆ่า"><Strikethrough className="w-4 h-4" /></button>
          <span className="w-px bg-[var(--border)] mx-0.5" />
          <button onClick={() => e?.chain().focus().toggleHeading({ level: 2 }).run()} className={`${tb} ${active(!!e?.isActive("heading", { level: 2 }))}`} title="หัวข้อ"><Heading2 className="w-4 h-4" /></button>
          <button onClick={() => e?.chain().focus().toggleHeading({ level: 3 }).run()} className={`${tb} ${active(!!e?.isActive("heading", { level: 3 }))}`} title="หัวข้อย่อย"><Heading3 className="w-4 h-4" /></button>
          <button onClick={() => e?.chain().focus().toggleBulletList().run()} className={`${tb} ${active(!!e?.isActive("bulletList"))}`} title="ลิสต์"><List className="w-4 h-4" /></button>
          <button onClick={() => e?.chain().focus().toggleOrderedList().run()} className={`${tb} ${active(!!e?.isActive("orderedList"))}`} title="ลิสต์เลข"><ListOrdered className="w-4 h-4" /></button>
          <button onClick={() => e?.chain().focus().toggleBlockquote().run()} className={`${tb} ${active(!!e?.isActive("blockquote"))}`} title="อ้างอิง"><Quote className="w-4 h-4" /></button>
          <button onClick={() => e?.chain().focus().setHorizontalRule().run()} className={tb} title="เส้นคั่นฉาก"><Minus className="w-4 h-4" /></button>
          <span className="w-px bg-[var(--border)] mx-0.5" />
          <button onClick={addLink} className={`${tb} ${active(!!e?.isActive("link"))}`} title="ลิงก์"><Link2 className="w-4 h-4" /></button>
          <button onClick={() => fileRef.current?.click()} disabled={uploadingImg} className={tb} title="แทรกรูป">{uploadingImg ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImagePlus className="w-4 h-4" />}</button>
          <button onClick={() => e?.chain().focus().setTextAlign("left").run()} className={`${tb} ${active(!!e?.isActive({ textAlign: "left" }))}`} title="ชิดซ้าย"><AlignLeft className="w-4 h-4" /></button>
          <button onClick={() => e?.chain().focus().setTextAlign("center").run()} className={`${tb} ${active(!!e?.isActive({ textAlign: "center" }))}`} title="กึ่งกลาง"><AlignCenter className="w-4 h-4" /></button>
          <button onClick={() => e?.chain().focus().setTextAlign("right").run()} className={`${tb} ${active(!!e?.isActive({ textAlign: "right" }))}`} title="ชิดขวา"><AlignRight className="w-4 h-4" /></button>
          <span className="w-px bg-[var(--border)] mx-0.5" />
          <button onClick={() => e?.chain().focus().undo().run()} className={tb} title="ย้อนกลับ"><Undo2 className="w-4 h-4" /></button>
          <button onClick={() => e?.chain().focus().redo().run()} className={tb} title="ทำซ้ำ"><Redo2 className="w-4 h-4" /></button>
          <span className="w-px bg-[var(--border)] mx-0.5" />
          <button onClick={() => setShowFind((v) => !v)} className={`${tb} ${active(showFind)}`} title="ค้นหา-แทนที่"><Search className="w-4 h-4" /></button>
          {chapterId && <button onClick={() => (showHistory ? setShowHistory(false) : openHistory())} className={`${tb} ${active(showHistory)}`} title="ประวัติเวอร์ชัน"><History className="w-4 h-4" /></button>}
          <button onClick={() => setFocus((v) => !v)} className={`${tb} ${active(focus)}`} title="โหมดโฟกัส"><Maximize2 className="w-4 h-4" /></button>
        </div>

        {showFind && (
          <div className="flex flex-wrap items-center gap-2 mb-2 p-2 bg-[var(--bg-surface)] border border-[var(--border)] text-sm">
            <input value={findText} onChange={(ev) => setFindText(ev.target.value)} placeholder="ค้นหา" className="bg-[var(--bg-card)] border border-[var(--border)] px-2 py-1 text-[var(--text-primary)]" />
            <input value={replaceText} onChange={(ev) => setReplaceText(ev.target.value)} placeholder="แทนที่ด้วย" className="bg-[var(--bg-card)] border border-[var(--border)] px-2 py-1 text-[var(--text-primary)]" />
            <button onClick={replaceAll} className="px-3 py-1 bal-btn text-xs">แทนที่ทั้งหมด</button>
          </div>
        )}

        {showHistory && (
          <div className="mb-2 p-3 bg-[var(--bg-surface)] border border-[var(--border)]">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold text-[var(--text-primary)] flex items-center gap-1.5"><History className="w-4 h-4" /> ประวัติเวอร์ชัน</span>
              <button onClick={() => setShowHistory(false)} className="text-[var(--text-secondary)] hover:text-[var(--text-primary)]"><X className="w-4 h-4" /></button>
            </div>
            {revsLoading ? (
              <p className="text-xs text-[var(--text-secondary)] flex items-center gap-1.5"><Loader2 className="w-3.5 h-3.5 animate-spin" /> กำลังโหลด...</p>
            ) : revisions.length === 0 ? (
              <p className="text-xs text-[var(--text-muted)]">ยังไม่มีเวอร์ชันก่อนหน้า — ระบบจะบันทึกให้อัตโนมัติเมื่อแก้ไขเป็นช่วงๆ</p>
            ) : (
              <ul className="flex flex-col gap-1.5 max-h-60 overflow-y-auto">
                {revisions.map((rv) => (
                  <li key={rv.id} className="flex items-center justify-between gap-2 text-sm border border-[var(--border)] px-2.5 py-1.5">
                    <span className="min-w-0 text-[var(--text-secondary)] truncate">
                      <span className="text-[var(--text-primary)]">{fmtDate(rv.createdAt)}</span>
                      <span className="text-[11px]"> · {rv.words.toLocaleString()} คำ</span>
                      {rv.title && <span className="text-[11px]"> · {rv.title}</span>}
                    </span>
                    <span className="flex items-center gap-1 shrink-0">
                      <button onClick={() => previewRevision(rv.id)} className="px-2 py-1 border border-[var(--border)] text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] flex items-center gap-1"><Eye className="w-3 h-3" /> ดู</button>
                      <button onClick={() => restoreRevision(rv.id)} disabled={restoring} className="px-2 py-1 border border-[var(--border)] text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] flex items-center gap-1"><RotateCcw className="w-3 h-3" /> กู้คืน</button>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {previewRev && (
          <div className="fixed inset-0 z-[60] bg-black/70 flex items-center justify-center p-4" onClick={() => setPreviewRev(null)}>
            <div className="bg-[var(--bg-primary)] border border-[var(--border)] max-w-2xl w-full max-h-[80vh] overflow-y-auto p-5" onClick={(ev) => ev.stopPropagation()}>
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-[var(--text-secondary)] flex items-center gap-1.5"><Eye className="w-4 h-4" /> ตัวอย่าง · {fmtDate(previewRev.createdAt)}</span>
                <button onClick={() => setPreviewRev(null)} className="text-[var(--text-secondary)] hover:text-[var(--text-primary)]"><X className="w-4 h-4" /></button>
              </div>
              {previewRev.title && <h3 className="font-semibold text-[var(--text-primary)] mb-2">{previewRev.title}</h3>}
              <div className="text-[var(--text-primary)] text-sm leading-relaxed [&_p]:mb-3 [&_h2]:text-lg [&_h2]:font-semibold [&_h3]:font-semibold [&_img]:max-w-full" dangerouslySetInnerHTML={{ __html: previewRev.content || "<p>(ว่าง)</p>" }} />
              <div className="mt-4 flex justify-end">
                <button onClick={() => restoreRevision(previewRev.id)} disabled={restoring} className="px-4 py-2 bal-btn text-sm font-semibold flex items-center gap-1.5">
                  {restoring ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />} กู้คืนเวอร์ชันนี้
                </button>
              </div>
            </div>
          </div>
        )}

        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onPickImage} />

        {/* editor */}
        <div className="bg-[var(--bg-card)] border border-[var(--border)] px-4 py-3 text-[var(--text-primary)]">
          <EditorContent editor={editor} />
        </div>

        {/* count + goal */}
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-[var(--text-secondary)] mt-2">
          <span>{words.toLocaleString()} คำ · {chars.toLocaleString()} ตัวอักษร · ~{Math.max(1, Math.round(words / 200))} นาที</span>
          <span className="flex items-center gap-2">
            <span className="flex items-center gap-1"><Target className="w-3.5 h-3.5" />
              <input value={goal || ""} onChange={(ev) => { const g = parseInt(ev.target.value) || 0; setGoal(g); try { localStorage.setItem("novelWordGoal", String(g)); } catch {} }} type="number" min="0" placeholder="เป้าคำ" className="w-20 bg-[var(--bg-card)] border border-[var(--border)] px-2 py-0.5 text-[var(--text-primary)]" />
            </span>
            <span>{saveState === "saving" ? "กำลังบันทึก..." : saveState === "saved" ? "บันทึกแล้ว ✓" : saveState === "error" ? "บันทึกไม่สำเร็จ" : "บันทึกร่างอัตโนมัติ"}</span>
          </span>
        </div>
        {goal > 0 && (
          <div className="h-1 w-full bg-[var(--bg-card)] border border-[var(--border)] mt-1 overflow-hidden">
            <div className="h-full bg-[var(--text-primary)]" style={{ width: `${Math.min(100, Math.round((words / goal) * 100))}%` }} />
          </div>
        )}

        {/* author note */}
        {!focus && (
          <label className="block text-sm mt-5">
            <span className="block text-xs text-[var(--text-secondary)] uppercase tracking-wide mb-1">โน้ตผู้เขียน (ท้ายตอน)</span>
            <textarea value={authorNote} onChange={(ev) => setAuthorNote(ev.target.value)} rows={2} placeholder="เช่น ขอบคุณที่อ่าน / ฝากกำลังใจด้วยนะครับ" className="w-full bg-[var(--bg-card)] border border-[var(--border)] px-3 py-2 text-[var(--text-primary)] resize-y" />
          </label>
        )}

        {/* premium */}
        {!focus && (
          <div className="mt-4 border border-[var(--border)] bg-[var(--bg-surface)] p-4">
            <button onClick={() => setIsPremium((v) => !v)} className="flex items-center gap-3 text-sm">
              <span className={`w-10 h-6 flex items-center px-0.5 transition-colors ${isPremium ? "bg-[var(--text-primary)] justify-end" : "bg-[var(--bg-card)] border border-[var(--border)]"}`}>
                <span className={`w-5 h-5 ${isPremium ? "bg-[var(--bg-primary)]" : "bg-[var(--text-secondary)]"}`} />
              </span>
              <span className="text-[var(--text-primary)] font-medium">ตอนพรีเมียม (ปลดด้วยเหรียญ)</span>
            </button>
            {isPremium && (
              <div className="space-y-3 mt-3">
                <label className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
                  <Coins className="w-4 h-4 text-[var(--text-primary)]" /> ราคา
                  <input value={coinCost} onChange={(ev) => setCoinCost(ev.target.value)} type="number" min="1" className="w-20 bg-[var(--bg-card)] border border-[var(--border)] px-2 py-1 text-[var(--text-primary)]" /> เหรียญ
                </label>
                <label className="flex flex-wrap items-center gap-2 text-sm text-[var(--text-secondary)]">
                  <Clock className="w-4 h-4 text-[var(--text-primary)]" /> อ่านล่วงหน้า
                  <input value={earlyDays} onChange={(ev) => setEarlyDays(ev.target.value)} type="number" min="0" placeholder="0" className="w-20 bg-[var(--bg-card)] border border-[var(--border)] px-2 py-1 text-[var(--text-primary)]" /> วัน
                  <span className="text-xs text-[var(--text-muted)]">(0 / ว่าง = ติดเหรียญถาวร)</span>
                </label>
              </div>
            )}
          </div>
        )}

        {error && <p className="text-sm text-[var(--text-primary)] mt-3">{error}</p>}

        {/* actions */}
        <div className="mt-5 flex flex-wrap items-center gap-2">
          <button onClick={() => doSave({ status: "DRAFT" })} disabled={saveState === "saving"} className="px-4 py-2.5 border border-[var(--border)] text-[var(--text-primary)] text-sm font-semibold flex items-center gap-1.5 hover:bg-[var(--bg-card)]">
            {saveState === "saving" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} บันทึกร่าง
          </button>
          <button onClick={publish} disabled={saveState === "saving"} className="px-4 py-2.5 bal-btn text-sm font-semibold flex items-center gap-1.5">
            <Send className="w-4 h-4" /> เผยแพร่
          </button>
          <span className="flex items-center gap-1.5 text-sm">
            <input type="datetime-local" value={scheduleAt} onChange={(ev) => setScheduleAt(ev.target.value)} className="bg-[var(--bg-card)] border border-[var(--border)] px-2 py-2 text-[var(--text-primary)]" />
            <button onClick={schedule} disabled={saveState === "saving"} className="px-3 py-2.5 border border-[var(--border)] text-[var(--text-primary)] text-sm flex items-center gap-1.5 hover:bg-[var(--bg-card)]">
              <Clock className="w-4 h-4" /> ตั้งเวลา
            </button>
          </span>
          {status === "PUBLISHED" && <span className="text-xs text-[var(--text-secondary)]">สถานะ: เผยแพร่แล้ว</span>}
        </div>

        {focus && (
          <button onClick={() => setFocus(false)} className="fixed top-3 right-3 z-50 w-9 h-9 flex items-center justify-center border border-[var(--border)] bg-[var(--bg-surface)] text-[var(--text-primary)]"><X className="w-4 h-4" /></button>
        )}
      </div>
    </div>
  );
}
