// Deep QA: drive the WRITER journey through the real UI (dev:3000 → prod DB).
// Env: QA_EMAIL, QA_PASS. Reports every console error + any HTTP >= 400.
const { chromium } = require("playwright");

const BASE = "http://localhost:3000";
const EMAIL = process.env.QA_EMAIL;
const PASS = process.env.QA_PASS;
const TITLE = "ทดสอบ QA นิยายไทย " + Date.now(); // Thai title → exercises slug decode

const problems = [];
const steps = [];
function ok(s) { steps.push("  ✅ " + s); console.log("✅ " + s); }
function bad(s) { problems.push(s); steps.push("  ❌ " + s); console.log("❌ " + s); }

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 1400 } });
  const page = await ctx.newPage();

  // Collect runtime noise. Ignore known-harmless dev warnings + expected aborts.
  const IGNORE = /Download the React DevTools|hydration|HMR|favicon|Warning: |\[Fast Refresh\]/i;
  page.on("console", (m) => { if (m.type() === "error" && !IGNORE.test(m.text())) problems.push("console.error: " + m.text().slice(0, 200)); });
  page.on("pageerror", (e) => problems.push("pageerror: " + String(e).slice(0, 200)));
  page.on("response", (r) => {
    const u = r.url();
    if (!u.startsWith(BASE)) return;
    if (r.status() >= 400 && !/_next\/|favicon|\.map$/.test(u))
      problems.push(`HTTP ${r.status()} ${r.request().method()} ${u.replace(BASE, "")}`);
  });

  try {
    // ── 1. Login ────────────────────────────────────────────────
    await page.goto(`${BASE}/auth/signin`, { waitUntil: "domcontentloaded" });
    await page.fill('input[type="email"]', EMAIL);
    await page.fill('input[type="password"]', PASS);
    await page.click('button[type="submit"]');
    // poll for the session cookie
    let authed = false;
    for (let i = 0; i < 20; i++) {
      const cookies = await ctx.cookies();
      if (cookies.some((c) => c.name.includes("session-token") && c.value)) { authed = true; break; }
      await page.waitForTimeout(500);
    }
    authed ? ok("login (credentials) → session cookie set") : bad("login failed — no session cookie");

    // ── 2. Dashboard loads ──────────────────────────────────────
    await page.goto(`${BASE}/dashboard`, { waitUntil: "domcontentloaded" });
    const onDash = page.url().includes("/dashboard");
    onDash ? ok("dashboard loads (creator, not redirected)") : bad("dashboard redirected away: " + page.url());

    // ── 3. Create a novel (Thai title) ──────────────────────────
    await page.goto(`${BASE}/dashboard/new-novel`, { waitUntil: "domcontentloaded" });
    await page.fill('input[placeholder*="รักนี้"]', TITLE);
    await page.fill('textarea[placeholder*="เกริ่น"]', "เรื่องย่อสำหรับทดสอบ QA");
    // pick the first genre chip if any
    const genreBtn = page.locator('button[type="button"].rounded-full').first();
    if (await genreBtn.count()) { await genreBtn.click().catch(() => {}); }
    await page.click('button:has-text("สร้างเรื่อง")');
    await page.waitForURL(/\/dashboard\/manga\/.+\/write/, { timeout: 15000 }).catch(() => {});
    const m = page.url().match(/\/dashboard\/manga\/([^/]+)\/write/);
    const slug = m ? decodeURIComponent(m[1]) : null;
    slug ? ok(`novel created → redirected to write (slug="${slug}")`) : bad("novel create did not redirect to /write: " + page.url());

    // ── 4. Write + publish first chapter ────────────────────────
    if (slug) {
      await page.waitForSelector(".ProseMirror", { timeout: 10000 });
      await page.fill('input[placeholder="(ไม่บังคับ)"]', "ตอนที่ 1 ทดสอบ");
      await page.locator(".ProseMirror").click();
      await page.keyboard.type("นี่คือเนื้อหาตอนทดสอบ QA เพื่อตรวจสอบว่าระบบเขียนนิยายทำงานปกติทุกขั้นตอน ".repeat(3));
      // Click publish quickly so the debounced autosave is still pending — this
      // is exactly the create/create race that used to 409 + leave a draft.
      await page.waitForTimeout(300);
      await page.click('button:has-text("เผยแพร่")');
      await page.waitForURL(/\/dashboard\/manga\/.+\/chapters/, { timeout: 15000 }).catch(() => {});
      const onChapters = page.url().includes("/chapters");
      onChapters ? ok("publish chapter → redirected to chapters list") : bad("publish did not redirect to chapters: " + page.url());

      // ── 5. Chapters list shows the chapter ────────────────────
      await page.goto(`${BASE}/dashboard/manga/${encodeURIComponent(slug)}/chapters`, { waitUntil: "domcontentloaded" });
      const bodyTxt = await page.locator("body").innerText();
      bodyTxt.includes("ตอนที่ 1") || /ตอน\s*1/.test(bodyTxt) ? ok("chapter visible in manage-chapters") : bad("published chapter not visible in chapters list");

      // ── 6. Dashboard tool pages (no 500) ──────────────────────
      for (const [label, path] of [
        ["analytics", `/dashboard/manga/${encodeURIComponent(slug)}/analytics`],
        ["story bible", `/dashboard/manga/${encodeURIComponent(slug)}/bible`],
        ["promote", `/dashboard/promote`],
        ["earnings", `/dashboard/earnings`],
      ]) {
        const resp = await page.goto(`${BASE}${path}`, { waitUntil: "domcontentloaded" });
        const st = resp ? resp.status() : 0;
        st < 400 && !page.url().includes("/auth/") ? ok(`${label} page loads (${st})`) : bad(`${label} page failed (status ${st}, url ${page.url()})`);
      }

      // ── 7. Export endpoints (txt + epub) ──────────────────────
      for (const fmt of ["txt", "epub"]) {
        const r = await page.request.get(`${BASE}/api/manga/${encodeURIComponent(slug)}/export?format=${fmt}`);
        r.ok() ? ok(`export ${fmt} (${r.status()}, ${(await r.body()).length} bytes)`) : bad(`export ${fmt} failed (${r.status()})`);
      }

      // ── 8. PUBLIC content page — THE Thai-slug bug test ───────
      const pub = await page.goto(`${BASE}/content/${encodeURIComponent(slug)}`, { waitUntil: "domcontentloaded" });
      const h1 = await page.locator("h1").first().innerText().catch(() => "");
      const pubOk = pub && pub.status() < 400 && h1.includes("ทดสอบ");
      pubOk ? ok(`public /content/[thai-slug] renders (no 404, h1="${h1.slice(0, 24)}")`) : bad(`public content page broken (status ${pub ? pub.status() : "?"}, h1="${h1}")`);

      // ── 9. Read the chapter publicly ──────────────────────────
      const readResp = await page.goto(`${BASE}/content/${encodeURIComponent(slug)}/1`, { waitUntil: "domcontentloaded" });
      const readTxt = await page.locator("body").innerText();
      readResp && readResp.status() < 400 && readTxt.includes("เนื้อหาตอนทดสอบ") ? ok("public chapter reader shows content") : bad(`public chapter reader broken (status ${readResp ? readResp.status() : "?"})`);

      // ── 10. Edit existing chapter (load + autosave PATCH) ──────
      // resolve the chapter id from the manage-chapters edit link
      await page.goto(`${BASE}/dashboard/manga/${encodeURIComponent(slug)}/chapters`, { waitUntil: "domcontentloaded" });
      const editHref = await page.locator('a[href*="write?ch="]').first().getAttribute("href").catch(() => null);
      const chId = editHref ? editHref.match(/ch=([^&]+)/)?.[1] : null;
      if (chId) {
        await page.goto(`${BASE}/dashboard/manga/${encodeURIComponent(slug)}/write?ch=${chId}`, { waitUntil: "domcontentloaded" });
        await page.waitForSelector(".ProseMirror", { timeout: 10000 });
        const loaded = (await page.locator(".ProseMirror").innerText()).includes("เนื้อหาตอนทดสอบ");
        loaded ? ok("edit chapter: existing content loaded into editor") : bad("edit chapter: content did not load");
        await page.locator(".ProseMirror").click();
        await page.keyboard.press("End");
        await page.keyboard.type(" [แก้ไขเพิ่ม]");
        // wait for debounced autosave PATCH
        const patchResp = await page.waitForResponse((r) => r.url().includes(`/api/chapters/${chId}`) && r.request().method() === "PATCH", { timeout: 6000 }).catch(() => null);
        patchResp && patchResp.ok() ? ok("edit chapter: autosave PATCH succeeded") : bad("edit chapter: autosave PATCH failed/absent");
      } else {
        bad("could not resolve chapter id for edit test");
      }
    }
    // ── 11. Cleanup: delete the novel we created this run ──────
    if (slug) {
      const del = await page.request.delete(`${BASE}/api/manga/${encodeURIComponent(slug)}`);
      del.ok() ? ok("cleanup: deleted test novel") : console.log("  (cleanup note: manga delete returned " + del.status() + " — teardown will cascade)");
    }
  } catch (e) {
    bad("EXCEPTION: " + String(e).slice(0, 300));
  } finally {
    await browser.close();
  }

  console.log("\n===== QA WRITER JOURNEY REPORT =====");
  steps.forEach((s) => console.log(s));
  console.log(`\n${problems.length === 0 ? "🟢 ALL CLEAN" : "🔴 " + problems.length + " PROBLEM(S)"}`);
  if (problems.length) { console.log("\n--- problems ---"); [...new Set(problems)].forEach((p) => console.log(" • " + p)); }
  process.exit(problems.length ? 1 : 0);
})();
