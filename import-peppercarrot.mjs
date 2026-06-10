// Importer for Pepper&Carrot (CC-BY 4.0 by David Revoy, https://peppercarrot.com).
// Downloads the freely-licensed rendered episode pages and hosts them on R2,
// creating one Manga ("Pepper & Carrot") with one Chapter per episode.
// Attribution is stored on the Manga (author / sourceUrl / license).
//
// Usage:  node import-peppercarrot.mjs [limit]   (limit = number of episodes)
import { readFileSync } from "node:fs";
import pg from "pg";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

const env = Object.fromEntries(
  readFileSync(".env", "utf8").split(/\r?\n/).filter((l) => l && !l.startsWith("#"))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i), l.slice(i + 1)]; })
);
const LIMIT = Number(process.argv[2]) || 39;
const BASE = "https://www.peppercarrot.com/0_sources";

const r2 = new S3Client({
  region: "auto",
  endpoint: `https://${env.CLOUDFLARE_R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId: env.CLOUDFLARE_R2_ACCESS_KEY_ID, secretAccessKey: env.CLOUDFLARE_R2_SECRET_ACCESS_KEY },
});
const BUCKET = env.CLOUDFLARE_R2_BUCKET_NAME;
const PUBLIC = env.CLOUDFLARE_R2_PUBLIC_URL;

const EPISODES = [
  "ep01_Potion-of-Flight","ep02_Rainbow-potions","ep03_The-secret-ingredients","ep04_Stroke-of-genius",
  "ep05_Special-holiday-episode","ep06_The-Potion-Contest","ep07_The-Wish","ep08_Pepper-s-Birthday-Party",
  "ep09_The-Remedy","ep10_Summer-Special","ep11_The-Witches-of-Chaosah","ep12_Autumn-Clearout",
  "ep13_The-Pyjama-Party","ep14_The-Dragon-s-Tooth","ep15_The-Crystal-Ball","ep16_The-Sage-of-the-Mountain",
  "ep17_A-Fresh-Start","ep18_The-Encounter","ep19_Pollution","ep20_The-Picnic","ep21_The-Magic-Contest",
  "ep22_The-Voting-System","ep23_Take-a-Chance","ep24_The-Unity-Tree","ep25_There-are-no-Shortcuts",
  "ep26_Books-Are-Great","ep27_Coriander-s-Invention","ep28_The-Festivities","ep29_Destroyer-of-Worlds",
  "ep30_Need-a-Hug","ep31_The-Fight","ep32_The-Battlefield","ep33_Spell-of-War","ep34_The-Knighting-of-Shichimi",
  "ep35_The-Reflection","ep36_The-Surprise-Attack","ep37_The-Tears-of-the-Phoenix","ep38_The-Healer","ep39_The-Tavern",
];
const pad = (n) => String(n).padStart(2, "0");
const titleOf = (folder) => folder.replace(/^ep\d+_/, "").replace(/-s-/g, "'s ").replace(/-/g, " ");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchRetry(url, tries = 4) {
  for (let t = 0; t < tries; t++) {
    try {
      const r = await fetch(url);
      return r;
    } catch (e) {
      if (t === tries - 1) throw e;
      await sleep(1000 * (t + 1));
    }
  }
}

const c = new pg.Client({ connectionString: env.DATABASE_URL });
await c.connect();
const MANGA_ID = "pepper-and-carrot";

// 1. upsert the series
await c.query(
  `INSERT INTO "Manga" (id,title,slug,description,"originCountry",status,type,"contentRating",author,"sourceUrl",license,"createdAt","updatedAt")
   VALUES ($1,$2,$3,$4,'FR','ONGOING','MANGA','EVERYONE',$5,$6,$7,now(),now())
   ON CONFLICT (id) DO UPDATE SET description=EXCLUDED.description,author=EXCLUDED.author,"sourceUrl"=EXCLUDED."sourceUrl",license=EXCLUDED.license,"updatedAt"=now()`,
  [MANGA_ID, "Pepper & Carrot", "pepper-and-carrot",
   "การผจญภัยแฟนตาซีสุดน่ารักของ Pepper แม่มดน้อยกับ Carrot แมวคู่ใจ ในโลกเวทมนตร์ Hereva — เว็บคอมิคโอเพนซอร์สโดย David Revoy เผยแพร่ภายใต้สัญญาอนุญาต Creative Commons (CC-BY)",
   "David Revoy", "https://www.peppercarrot.com", "CC-BY 4.0"]
);

// 2. link genres
const genres = (await c.query(`SELECT id FROM "Genre" WHERE slug IN ('fantasy','comedy','adventure')`)).rows;
for (const g of genres)
  await c.query(`INSERT INTO "MangaGenre" ("mangaId","genreId") VALUES ($1,$2) ON CONFLICT DO NOTHING`, [MANGA_ID, g.id]);

async function putImage(key, buf, type) {
  await r2.send(new PutObjectCommand({ Bucket: BUCKET, Key: key, Body: buf, ContentType: type, CacheControl: "public, max-age=31536000, immutable" }));
  return `${PUBLIC}/${key}`;
}

let firstPageUrl = null;
for (let i = 0; i < Math.min(LIMIT, EPISODES.length); i++) {
  const folder = EPISODES[i];
  const num = i + 1;

  // Resume: skip episodes already imported with pages.
  const have = (await c.query(
    `SELECT COUNT(*)::int n FROM "Page" p JOIN "Chapter" ch ON ch.id=p."chapterId" WHERE ch."mangaId"=$1 AND ch."chapterNum"=$2`,
    [MANGA_ID, num]
  )).rows[0].n;
  if (have > 0) { if (!firstPageUrl) firstPageUrl = ""; console.log(`• ${folder} → ตอนที่ ${num} (มีแล้ว ${have} หน้า, ข้าม)`); continue; }

  // fetch candidate pages P00..P14 (batches of 4 + retry, polite)
  const results = [];
  for (let p = 0; p < 15; p += 4) {
    const batch = await Promise.all(
      Array.from({ length: 4 }, (_, k) => p + k).filter((q) => q < 15).map(async (q) => {
        const url = `${BASE}/${folder}/low-res/en_Pepper-and-Carrot_by-David-Revoy_E${pad(num)}P${pad(q)}.jpg`;
        const r = await fetchRetry(url);
        if (!r.ok) return null;
        return { p: q, buf: Buffer.from(await r.arrayBuffer()) };
      })
    );
    results.push(...batch);
    if (batch.every((b) => b === null)) break; // no more pages in this range
  }
  const pages = results.filter(Boolean).sort((a, b) => a.p - b.p);
  if (pages.length === 0) { console.log(`✗ ${folder}: no pages`); continue; }

  // upsert chapter
  const ch = (await c.query(
    `INSERT INTO "Chapter" (id,"mangaId","chapterNum",title,"isPremium","coinCost","publishedAt","viewCount")
     VALUES (gen_random_uuid()::text,$1,$2,$3,false,0,now(),0)
     ON CONFLICT ("mangaId","chapterNum") DO UPDATE SET title=EXCLUDED.title RETURNING id`,
    [MANGA_ID, num, titleOf(folder)]
  )).rows[0];

  // upload pages + upsert Page rows
  for (let pi = 0; pi < pages.length; pi++) {
    const key = `peppercarrot/E${pad(num)}P${pad(pages[pi].p)}.jpg`;
    const imageUrl = await putImage(key, pages[pi].buf, "image/jpeg");
    if (!firstPageUrl) firstPageUrl = imageUrl;
    await c.query(
      `INSERT INTO "Page" (id,"chapterId","pageNum","imageUrl") VALUES (gen_random_uuid()::text,$1,$2,$3)
       ON CONFLICT ("chapterId","pageNum") DO UPDATE SET "imageUrl"=EXCLUDED."imageUrl"`,
      [ch.id, pi + 1, imageUrl]
    );
  }
  console.log(`✓ ${folder} → ตอนที่ ${num} "${titleOf(folder)}" (${pages.length} หน้า)`);
  await sleep(600); // be polite to the source server
}

// 3. set cover from the very first page if not set
if (firstPageUrl)
  await c.query(`UPDATE "Manga" SET "coverUrl"=$2 WHERE id=$1 AND "coverUrl" IS NULL`, [MANGA_ID, firstPageUrl]);

const stats = (await c.query(`SELECT (SELECT COUNT(*) FROM "Chapter" WHERE "mangaId"=$1) ch, (SELECT COUNT(*) FROM "Page" p JOIN "Chapter" c ON c.id=p."chapterId" WHERE c."mangaId"=$1) pg`, [MANGA_ID])).rows[0];
console.log(`\nDONE — Pepper & Carrot: ${stats.ch} ตอน, ${stats.pg} หน้า`);
await c.end();
