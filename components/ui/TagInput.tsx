"use client";

import { useState } from "react";
import { X } from "lucide-react";

export default function TagInput({
  value,
  onChange,
  max = 15,
  placeholder = "พิมพ์แท็กแล้วกด Enter เช่น ต่างโลก, นายเอกเย็นชา, ครูซ่อม",
}: {
  value: string[];
  onChange: (tags: string[]) => void;
  max?: number;
  placeholder?: string;
}) {
  const [input, setInput] = useState("");

  const add = (raw: string) => {
    const t = raw.trim().replace(/^#+/, "").slice(0, 30);
    if (!t) return;
    if (value.some((x) => x.toLowerCase() === t.toLowerCase())) { setInput(""); return; }
    if (value.length >= max) return;
    onChange([...value, t]);
    setInput("");
  };
  const remove = (t: string) => onChange(value.filter((x) => x !== t));

  return (
    <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl px-2.5 py-2 focus-within:border-[var(--text-primary)]/50">
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-1.5">
          {value.map((t) => (
            <span key={t} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[var(--text-primary)] text-[var(--bg-primary)] text-xs">
              #{t}
              <button type="button" onClick={() => remove(t)} className="hover:opacity-70">
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}
      <input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === ",") { e.preventDefault(); add(input); }
          else if (e.key === "Backspace" && !input && value.length) { remove(value[value.length - 1]); }
        }}
        onBlur={() => add(input)}
        placeholder={value.length >= max ? `ครบ ${max} แท็กแล้ว` : placeholder}
        disabled={value.length >= max}
        className="w-full bg-transparent text-sm text-[var(--text-primary)] focus:outline-none placeholder:text-[var(--text-muted)]"
      />
    </div>
  );
}
