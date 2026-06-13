import "dotenv/config";
import { readdirSync, statSync, readFileSync } from "fs";
import { join } from "path";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import sharp from "sharp";

const ROOT = "C:/Users/PC/Documents/Mangas";
const TRANSLATOR_ID = "8471e133-7c33-4ccb-8ea5-8939a82f6863"; // INKVERSE Official
const BUCKET = process.env.CLOUDFLARE_R2_BUCKET_NAME;
const PUBLIC_URL = process.env.CLOUDFLARE_R2_PUBLIC_URL;
const CONCURRENCY = 6;

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
const r2 = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.CLOUDFLARE_R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID, secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY },
});

const IMG = /\.(jpe?g|png|webp|gif|avif)$/i;
function slugify(name) {
  const m = name.match(/^[\x00-\x7F\s''’,.&-]+/);
  const ascii = m ? m[0] : name;
  return ascii.toLowerCase().replace(/[''’]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "manga";
}
const pageSort = (a, b) => {
  const na = parseInt(a), nb = parseInt(b);
  if (!isNaN(na) && !isNaN(nb) && na !== nb) return na - nb;
  return a.localeCompare(b, undefined, { numeric: true });
};
async function mapLimit(items, limit, fn) {
  const ret = []; let i = 0;
  const workers = Array.from({ length: limit }, async () => {
    while (i < items.length) { const idx = i++; ret[idx] = await fn(items[idx], idx); }
  });
  await Promise.all(workers);
  return ret;
}

async function ingestManga(folder) {
const mangaDir = join(ROOT, folder);
const slug = slugify(folder);

const manga = await prisma.manga.upsert({
  where: { slug },
  create: { slug, title: folder, description: folder, type: "MANHWA", status: "ONGOING", contentRating: "TEEN", originCountry: "KR", translatorId: TRANSLATOR_ID },
  update: { translatorId: TRANSLATOR_ID },
});
console.log(`MANGA: ${folder}  →  /content/${slug}  (id ${manga.id})`);

const chapterDirs = readdirSync(mangaDir).filter((d) => statSync(join(mangaDir, d)).isDirectory());
// First number in the folder name only — "ตอนที่ 100 ( จบซีซั่น 2 )" → 100,
// NOT 1002 (concatenating every digit was a bug).
const chapNum = (s) => { const m = s.match(/(\d+(?:\.\d+)?)/); return m ? parseFloat(m[1]) : NaN; };
chapterDirs.sort((a, b) => (chapNum(a) || 0) - (chapNum(b) || 0));

let chDone = 0, imgDone = 0, chSkipped = 0;
for (const cd of chapterDirs) {
  const chapterNum = chapNum(cd);
  if (isNaN(chapterNum)) { console.log("  skip non-numeric:", cd); continue; }
  const files = readdirSync(join(mangaDir, cd)).filter((f) => IMG.test(f)).sort(pageSort);
  if (!files.length) continue;

  const chapter = await prisma.chapter.upsert({
    where: { mangaId_chapterNum: { mangaId: manga.id, chapterNum } },
    create: { mangaId: manga.id, chapterNum, isPremium: false, coinCost: 0 },
    update: {},
  });
  const have = await prisma.page.count({ where: { chapterId: chapter.id } });
  if (have >= files.length) { chSkipped++; chDone++; continue; } // resume: already complete

  await mapLimit(files, CONCURRENCY, async (fname, idx) => {
    const pageNum = idx + 1;
    const raw = readFileSync(join(mangaDir, cd, fname));
    let out, meta;
    try {
      meta = await sharp(raw).metadata();
      // WebP caps each dimension at 16383px. Tall webtoon strips exceed that →
      // fall back to JPEG (handles up to 65535px). Otherwise prefer WebP.
      const tooTall = (meta.height ?? 0) > 16000 || (meta.width ?? 0) > 16000;
      const base = () => sharp(raw).rotate().resize({ width: 2560, withoutEnlargement: true });
      if (tooTall) {
        out = { buf: await base().jpeg({ quality: 90 }).toBuffer(), ext: "jpg", ct: "image/jpeg" };
      } else {
        try {
          out = { buf: await base().webp({ quality: 92 }).toBuffer(), ext: "webp", ct: "image/webp" };
        } catch {
          out = { buf: await base().jpeg({ quality: 90 }).toBuffer(), ext: "jpg", ct: "image/jpeg" };
        }
      }
    } catch (e) { console.log(`  ! ${cd}/${fname}: ${String(e).slice(0, 60)}`); return; }
    const key = `pages/${chapter.id}/${pageNum}.${out.ext}`;
    await r2.send(new PutObjectCommand({ Bucket: BUCKET, Key: key, Body: out.buf, ContentType: out.ct }));
    await prisma.page.upsert({
      where: { chapterId_pageNum: { chapterId: chapter.id, pageNum } },
      create: { chapterId: chapter.id, pageNum, imageUrl: `${PUBLIC_URL}/${key}`, width: meta.width ?? null, height: meta.height ?? null },
      update: { imageUrl: `${PUBLIC_URL}/${key}`, width: meta.width ?? null, height: meta.height ?? null },
    });
    imgDone++;
  });
  chDone++;
  if (chDone % 5 === 0) console.log(`  ...${chDone}/${chapterDirs.length} ch, ${imgDone} pages uploaded`);
}
await prisma.manga.update({ where: { id: manga.id }, data: { updatedAt: new Date() } });
console.log(`DONE [${folder}]: ${chDone} chapters (${chSkipped} already complete), ${imgDone} pages uploaded`);
}

// Run a single folder (arg) or ALL folders under ROOT (resume-safe: completed
// chapters are skipped fast).
const arg = process.argv[2];
const folders = arg && arg !== "--all"
  ? [arg]
  : readdirSync(ROOT).filter((d) => statSync(join(ROOT, d)).isDirectory()).sort();
const SKIP = new Set(["ลงแล้ว"]); // archive folder of already-uploaded manga
for (const f of folders) {
  if (SKIP.has(f)) { console.log("ข้ามโฟลเดอร์เก็บ:", f); continue; }
  try { await ingestManga(f); }
  catch (e) { console.log(`!! FAILED ${f}: ${String(e).slice(0, 120)}`); }
}
await prisma.$disconnect();
console.log("ALL DONE");
