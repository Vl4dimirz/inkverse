"use client";

import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { Download, X, Check, Lock, Loader2 } from "lucide-react";
import { downloadById, getDownloads, OFFLINE_ENABLED } from "@/lib/offline";

interface Ch {
  id: string;
  chapterNum: number;
  title?: string | null;
  locked: boolean;
}

interface Props {
  mangaSlug: string;
  mangaTitle: string;
  chapters: Ch[];
}

// App-only "download chapters" picker (under the bookmark button on the manga
// page): tick chapters (or select all) and save them for offline reading.
export default function DownloadMangaButton({ chapters }: Props) {
  const [inApp, setInApp] = useState(false);
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [done, setDone] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [prog, setProg] = useState({ at: 0, total: 0, pct: 0 });
  const cancel = useRef(false);

  const refreshDone = () => {
    try {
      const ids = new Set(getDownloads().map((d) => d.chapterId));
      setDone(new Set(chapters.filter((c) => ids.has(c.id)).map((c) => c.id)));
    } catch {}
  };

  useEffect(() => {
    setInApp(!!(window as unknown as { Capacitor?: unknown }).Capacitor);
    refreshDone();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!OFFLINE_ENABLED || !inApp) return null;

  const available = chapters.filter((c) => !c.locked && !done.has(c.id));
  const allSelected = available.length > 0 && available.every((c) => selected.has(c.id));

  const toggle = (id: string) =>
    setSelected((s) => {
      const n = new Set(s);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });

  const toggleAll = () =>
    setSelected(allSelected ? new Set() : new Set(available.map((c) => c.id)));

  const start = async () => {
    const ids = chapters.filter((c) => selected.has(c.id) && !c.locked && !done.has(c.id)).map((c) => c.id);
    if (!ids.length) return;
    setBusy(true);
    cancel.current = false;
    let i = 0;
    for (const id of ids) {
      if (cancel.current) break;
      setProg({ at: ++i, total: ids.length, pct: 0 });
      try {
        await downloadById(id, (d, t) => setProg((p) => ({ ...p, pct: Math.round((d / t) * 100) })));
        setDone((s) => new Set(s).add(id));
      } catch {
        /* skip a failed chapter, keep going */
      }
    }
    setBusy(false);
    setSelected(new Set());
    refreshDone();
  };

  return (
    <>
      <button
        onClick={() => {
          refreshDone();
          setOpen(true);
        }}
        className="w-full py-3 rounded-xl bg-[var(--bg-card)] border border-[var(--border)] text-[var(--text-primary)] text-sm font-semibold flex items-center justify-center gap-2 hover:border-white/30 transition-all"
      >
        <Download className="w-4 h-4" />
        ดาวน์โหลดตอน
      </button>

      {open &&
        typeof document !== "undefined" &&
        createPortal(
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/70" onClick={() => !busy && setOpen(false)}>
          <div
            className="w-full sm:max-w-md bg-[var(--bg-surface)] border border-[var(--border)] rounded-t-2xl sm:rounded-2xl max-h-[85vh] flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* header */}
            <div className="flex items-center justify-between p-4 border-b border-[var(--border)]">
              <h3 className="font-bebas text-xl tracking-wider text-[var(--text-primary)]">
                ดาวน์โหลดเก็บออฟไลน์
              </h3>
              {!busy && (
                <button onClick={() => setOpen(false)} aria-label="ปิด" className="text-[var(--text-muted)] hover:text-[var(--text-primary)]">
                  <X className="w-5 h-5" />
                </button>
              )}
            </div>

            {/* select all */}
            {available.length > 0 && !busy && (
              <button
                onClick={toggleAll}
                className="w-full flex items-center justify-between gap-3 px-4 py-2.5 text-sm text-[var(--text-primary)] border-b border-[var(--border)] hover:bg-white/5"
              >
                <span className="min-w-0 truncate">เลือกทั้งหมด ({available.length} ตอน)</span>
                <span className={`w-5 h-5 rounded border flex items-center justify-center shrink-0 ${allSelected ? "bg-[var(--text-primary)] border-[var(--text-primary)]" : "border-[var(--border)]"}`}>
                  {allSelected && <Check className="w-3.5 h-3.5 text-[var(--bg-primary)]" />}
                </span>
              </button>
            )}

            {/* chapter list */}
            <div className="overflow-y-auto flex-1">
              {chapters.map((c) => {
                const isDone = done.has(c.id);
                const isSel = selected.has(c.id);
                return (
                  <button
                    key={c.id}
                    disabled={c.locked || isDone || busy}
                    onClick={() => toggle(c.id)}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm border-b border-[var(--border)]/50 disabled:opacity-50 hover:bg-white/5"
                  >
                    <span className={`w-5 h-5 rounded border flex items-center justify-center shrink-0 ${isSel ? "bg-[var(--text-primary)] border-[var(--text-primary)]" : "border-[var(--border)]"}`}>
                      {isDone ? <Check className="w-3.5 h-3.5 text-[var(--text-primary)]" /> : isSel ? <Check className="w-3.5 h-3.5 text-[var(--bg-primary)]" /> : c.locked ? <Lock className="w-3 h-3 text-[var(--text-muted)]" /> : null}
                    </span>
                    <span className="flex-1 min-w-0 text-[var(--text-primary)] truncate">
                      ตอนที่ {c.chapterNum}
                      {c.title ? ` — ${c.title}` : ""}
                    </span>
                    {isDone && <span className="text-[10px] text-[var(--text-secondary)] shrink-0">โหลดแล้ว</span>}
                    {c.locked && <span className="text-[10px] text-[var(--text-secondary)] shrink-0">ล็อก</span>}
                  </button>
                );
              })}
            </div>

            {/* footer */}
            <div className="p-4 border-t border-[var(--border)]">
              {busy ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs text-[var(--text-secondary)]">
                    <span className="flex items-center gap-1.5">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      กำลังโหลด ตอน {prog.at}/{prog.total} ({prog.pct}%)
                    </span>
                    <button onClick={() => (cancel.current = true)} className="text-[var(--text-primary)] underline">
                      หยุด
                    </button>
                  </div>
                  <div className="h-1 bg-white/10 rounded">
                    <div className="h-full bg-[var(--text-primary)] rounded transition-all" style={{ width: `${((prog.at - 1) / prog.total) * 100 + prog.pct / prog.total}%` }} />
                  </div>
                </div>
              ) : (
                <button
                  onClick={start}
                  disabled={selected.size === 0}
                  className="w-full py-2.5 rounded-xl bal-btn text-sm font-semibold disabled:opacity-40"
                >
                  โหลด {selected.size} ตอนที่เลือก
                </button>
              )}
            </div>
          </div>
        </div>,
        document.body
        )}
    </>
  );
}
