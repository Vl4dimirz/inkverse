/**
 * INKVERSE proofreading pipeline (operator tool — run locally, AI stays OFF the
 * public site, you control the token budget).
 *
 * Usage:
 *   npx tsx scripts/proofread.mts <manuscript.txt> [--ai]
 *
 * Steps:
 *   1) Rule-based pre-pass (FREE, instant) — lib/thaiSpellcheck: mechanical
 *      errors + curated common misspellings.
 *   2) Optional AI pass (--ai, needs ANTHROPIC_API_KEY) — Opus does a careful,
 *      voice-preserving proofread on top, chunked. Prints token usage so you can
 *      watch the spend.
 *   3) Writes an HTML correction report next to the input (open in a browser,
 *      review, then apply/send to the client).
 *
 * Input: plain .txt (export a Google Doc / .docx to .txt first).
 */
import { readFileSync, writeFileSync } from "fs";
import { checkThaiRules, type Issue } from "../lib/thaiSpellcheck/rules";

const MODEL = "claude-opus-4-8";
const CHUNK_CHARS = 6000; // ~a few pages/chunk → bounded AI output + cost

type Correction = { wrong: string; right: string; reason: string; source: "rule" | "ai" };

// Thai has no spaces — whitespace splitting massively undercounts. Use the
// native segmenter so word counts (= billing) and chunk sizing are real.
const seg = new Intl.Segmenter("th", { granularity: "word" });
function wordCount(text: string): number {
  let n = 0;
  for (const s of seg.segment(text)) if (s.isWordLike) n++;
  return n;
}

function ctx(text: string, start: number, end: number, pad = 24): string {
  const a = Math.max(0, start - pad), b = Math.min(text.length, end + pad);
  return (a > 0 ? "…" : "") + text.slice(a, start) + "⟦" + text.slice(start, end) + "⟧" + text.slice(end, b) + (b < text.length ? "…" : "");
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// ── 1) rule-based pass ────────────────────────────────────────────────────────
function rulePass(text: string): { issues: Issue[] } {
  return { issues: checkThaiRules(text) };
}

// ── 2) AI pass (optional) ─────────────────────────────────────────────────────
const PROMPT = `คุณคือนักพิสูจน์อักษรภาษาไทยมืออาชีพ ตรวจข้อความนิยายต่อไปนี้

กฎเหล็ก:
- แก้เฉพาะ: คำสะกดผิด, วรรณยุกต์, การันต์, เว้นวรรค, คำตก/คำเกิน, เครื่องหมายวรรคตอน
- ห้ามเด็ดขาด: เปลี่ยนสำนวน/คำที่ผู้เขียนเลือกใช้, รีไรต์ประโยค, เปลี่ยนความหมาย, เพิ่ม-ลดเนื้อหา
- ถ้าไม่มั่นใจว่าผิด ให้ข้าม (เลี่ยง false positive — เรายอมพลาดดีกว่าจู้จี้)

ตอบเป็น JSON array เท่านั้น ห้ามมีข้อความอื่น:
[{"wrong":"<ข้อความเดิมที่ผิด สั้นๆ>","right":"<ที่ถูก>","reason":"<เหตุผลสั้นๆ>"}]
ถ้าไม่พบที่ผิดเลย ตอบ []

ข้อความ:
---
`;

async function aiPass(chunk: string): Promise<{ corrections: Correction[]; tokens: { in: number; out: number } }> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("ANTHROPIC_API_KEY ไม่ได้ตั้ง — ใส่ key ก่อนใช้ --ai");
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({ model: MODEL, max_tokens: 4000, messages: [{ role: "user", content: PROMPT + chunk + "\n---" }] }),
  });
  if (!res.ok) throw new Error(`Anthropic ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = (await res.json()) as { content?: { text?: string }[]; usage?: { input_tokens?: number; output_tokens?: number } };
  const raw = data.content?.map((c) => c.text || "").join("") ?? "[]";
  let arr: { wrong?: string; right?: string; reason?: string }[] = [];
  try { arr = JSON.parse(raw.slice(raw.indexOf("["), raw.lastIndexOf("]") + 1)); } catch { /* leave empty on parse fail */ }
  return {
    corrections: arr.filter((c) => c.wrong && c.right).map((c) => ({ wrong: c.wrong!, right: c.right!, reason: c.reason || "", source: "ai" as const })),
    tokens: { in: data.usage?.input_tokens ?? 0, out: data.usage?.output_tokens ?? 0 },
  };
}

function chunkText(text: string, chars: number): string[] {
  const paras = text.split(/\n{2,}/);
  const out: string[] = [];
  let cur = "";
  for (const p of paras) {
    if (cur.length + p.length > chars && cur) { out.push(cur); cur = ""; }
    cur += (cur ? "\n\n" : "") + p;
  }
  if (cur) out.push(cur);
  return out;
}

// ── report ────────────────────────────────────────────────────────────────────
function report(file: string, text: string, issues: Issue[], ai: Correction[], tokens: { in: number; out: number }): string {
  const byType: Record<string, number> = {};
  for (const i of issues) byType[i.type] = (byType[i.type] || 0) + 1;
  const ruleRows = issues.map((i) =>
    `<tr><td>${i.severity === "error" ? "ผิด" : "เตือน"}</td><td><b>${esc(text.slice(i.start, i.end))}</b></td><td>${esc(i.suggestion || "-")}</td><td>${esc(i.message)}</td><td class="ctx">${esc(ctx(text, i.start, i.end))}</td></tr>`
  ).join("");
  const aiRows = ai.map((c) =>
    `<tr><td>AI</td><td><b>${esc(c.wrong)}</b></td><td>${esc(c.right)}</td><td>${esc(c.reason)}</td><td></td></tr>`
  ).join("");
  return `<!doctype html><meta charset="utf-8"><title>รายงานพิสูจน์อักษร — ${esc(file)}</title>
<style>body{background:#000;color:#eee;font-family:"Leelawadee UI",Tahoma,sans-serif;padding:32px;max-width:1000px;margin:0 auto}
h1{font-size:22px;letter-spacing:.05em}.sum{color:#9a9a9a;font-size:14px;margin:8px 0 24px}
table{width:100%;border-collapse:collapse;font-size:14px}td,th{border:1px solid #2a2a2a;padding:7px 10px;text-align:left;vertical-align:top}
th{color:#9a9a9a;text-transform:uppercase;letter-spacing:.05em;font-size:11px}b{color:#fff}.ctx{color:#888;font-size:12px}
h2{font-size:15px;color:#fff;margin-top:28px;border-bottom:1px solid #2a2a2a;padding-bottom:6px}</style>
<h1>รายงานพิสูจน์อักษร — INKVERSE</h1>
<p class="sum">ไฟล์: ${esc(file)} · ${wordCount(text).toLocaleString()} คำ · พบ ${issues.length} จุด (rule) + ${ai.length} จุด (AI)${tokens.in ? ` · token: ${tokens.in.toLocaleString()} in / ${tokens.out.toLocaleString()} out` : ""}</p>
<h2>ชั้นกฎ (ฟรี) — ${issues.length} จุด</h2>
<table><tr><th>ระดับ</th><th>คำผิด</th><th>แก้เป็น</th><th>เหตุผล</th><th>บริบท</th></tr>${ruleRows || '<tr><td colspan=5>—</td></tr>'}</table>
${ai.length || aiRows ? `<h2>ชั้น AI (Opus) — ${ai.length} จุด</h2><table><tr><th></th><th>คำผิด</th><th>แก้เป็น</th><th>เหตุผล</th><th></th></tr>${aiRows}</table>` : ""}`;
}

// ── main ──────────────────────────────────────────────────────────────────────
(async () => {
  const file = process.argv[2];
  const useAi = process.argv.includes("--ai");
  if (!file) { console.error("usage: npx tsx scripts/proofread.mts <manuscript.txt> [--ai]"); process.exit(1); }
  const text = readFileSync(file, "utf8");
  console.log(`อ่าน ${file} — ${wordCount(text).toLocaleString()} คำ`);

  const { issues } = rulePass(text);
  console.log(`ชั้นกฎ (ฟรี): พบ ${issues.length} จุด`);

  const ai: Correction[] = [];
  const tok = { in: 0, out: 0 };
  if (useAi) {
    const chunks = chunkText(text, CHUNK_CHARS);
    console.log(`ชั้น AI: ${chunks.length} chunk (model ${MODEL})…`);
    for (let i = 0; i < chunks.length; i++) {
      try {
        const r = await aiPass(chunks[i]);
        ai.push(...r.corrections);
        tok.in += r.tokens.in; tok.out += r.tokens.out;
        console.log(`  chunk ${i + 1}/${chunks.length}: +${r.corrections.length} จุด (token ${r.tokens.in}/${r.tokens.out})`);
      } catch (e) { console.error(`  chunk ${i + 1} fail: ${(e as Error).message}`); }
    }
    console.log(`ชั้น AI รวม: ${ai.length} จุด · token ${tok.in.toLocaleString()} in / ${tok.out.toLocaleString()} out`);
  } else {
    console.log("ข้าม AI (ใส่ --ai + ANTHROPIC_API_KEY เพื่อเปิด)");
  }

  const out = file.replace(/\.[^.]+$/, "") + ".report.html";
  writeFileSync(out, report(file, text, issues, ai, tok), "utf8");
  console.log(`\n✅ รายงาน: ${out}  (เปิดในเบราว์เซอร์ รีวิวก่อนส่งลูกค้า)`);
})();
