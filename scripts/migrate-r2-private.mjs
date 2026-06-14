// Move existing manga page images + payment slips out of the PUBLIC R2 bucket
// into the PRIVATE bucket, repoint the DB to bare keys, and delete the public
// copies — closing the public-exposure hole for already-uploaded content.
//
// Covers / avatars / novel images are left in the public bucket on purpose.
//
// Usage (run from the project root, with .env loaded):
//   Dry run (shows what it would do, changes nothing):
//     node scripts/migrate-r2-private.mjs
//   Execute for real:
//     node scripts/migrate-r2-private.mjs --go
import {
  S3Client,
  CopyObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
} from "@aws-sdk/client-s3";
import pg from "pg";

const GO = process.argv.includes("--go");
const {
  DATABASE_URL,
  CLOUDFLARE_R2_ACCOUNT_ID,
  CLOUDFLARE_R2_ACCESS_KEY_ID,
  CLOUDFLARE_R2_SECRET_ACCESS_KEY,
  CLOUDFLARE_R2_BUCKET_NAME: PUBLIC_BUCKET,
  CLOUDFLARE_R2_PRIVATE_BUCKET: PRIVATE_BUCKET,
  CLOUDFLARE_R2_PUBLIC_URL: PUBLIC_URL,
} = process.env;

if (!PRIVATE_BUCKET) {
  console.error("✗ CLOUDFLARE_R2_PRIVATE_BUCKET is not set — aborting.");
  process.exit(1);
}

const s3 = new S3Client({
  region: "auto",
  endpoint: `https://${CLOUDFLARE_R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: CLOUDFLARE_R2_ACCESS_KEY_ID,
    secretAccessKey: CLOUDFLARE_R2_SECRET_ACCESS_KEY,
  },
});
const db = new pg.Client({ connectionString: DATABASE_URL });

const keyOf = (url) => url.replace(`${PUBLIC_URL}/`, "");
// CopySource must be "bucket/key" with the key path-encoded but slashes kept.
const copySource = (key) => `${PUBLIC_BUCKET}/${encodeURIComponent(key).replace(/%2F/g, "/")}`;

async function migrate(table, col) {
  const { rows } = await db.query(
    `SELECT id, "${col}" AS url FROM "${table}" WHERE "${col}" LIKE 'http%'`
  );
  console.log(`\n[${table}.${col}] ${rows.length} object(s) to migrate`);
  let done = 0,
    fail = 0;
  for (const r of rows) {
    const key = keyOf(r.url);
    try {
      if (GO) {
        await s3.send(
          new CopyObjectCommand({ Bucket: PRIVATE_BUCKET, Key: key, CopySource: copySource(key) })
        );
        await s3.send(new HeadObjectCommand({ Bucket: PRIVATE_BUCKET, Key: key })); // verify copy
        await db.query(`UPDATE "${table}" SET "${col}" = $1 WHERE id = $2`, [key, r.id]);
        await s3.send(new DeleteObjectCommand({ Bucket: PUBLIC_BUCKET, Key: key })); // remove public copy
      } else {
        console.log(`  would move: ${key}`);
      }
      done++;
      if (GO && done % 50 === 0) console.log(`  ...${done}/${rows.length}`);
    } catch (e) {
      fail++;
      console.error(`  FAIL ${key}: ${e.message}`);
    }
  }
  console.log(`[${table}.${col}] done=${done} fail=${fail}${GO ? "" : "  (DRY RUN — nothing changed)"}`);
}

await db.connect();
await migrate("Page", "imageUrl");
await migrate("CoinOrder", "slipUrl");
await db.end();
console.log(GO ? "\n✓ Migration complete." : "\n✓ Dry run complete. Re-run with --go to execute for real.");
