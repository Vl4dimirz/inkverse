import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export const r2Client = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.CLOUDFLARE_R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY!,
  },
});

const BUCKET = process.env.CLOUDFLARE_R2_BUCKET_NAME!;
const PUBLIC_URL = process.env.CLOUDFLARE_R2_PUBLIC_URL!;
// Sensitive objects (manga page images, payment slips) live here. The bucket has
// NO public access, so the only way to read them is a short-lived presigned URL
// minted server-side (see getPresignedDownloadUrl). Falls back to the public
// bucket if unset, so nothing breaks before the private bucket is configured.
const PRIVATE_BUCKET = process.env.CLOUDFLARE_R2_PRIVATE_BUCKET || BUCKET;

export async function uploadToR2(
  key: string,
  body: Buffer,
  contentType: string
): Promise<string> {
  await r2Client.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: body,
      ContentType: contentType,
    })
  );
  return `${PUBLIC_URL}/${key}`;
}

export async function deleteFromR2(key: string): Promise<void> {
  await r2Client.send(
    new DeleteObjectCommand({
      Bucket: BUCKET,
      Key: key,
    })
  );
}

export async function getPresignedUploadUrl(
  key: string,
  contentType: string
): Promise<string> {
  return getSignedUrl(
    r2Client,
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      ContentType: contentType,
    }),
    { expiresIn: 3600 }
  );
}

export function r2KeyFromUrl(url: string): string {
  return url.replace(`${PUBLIC_URL}/`, "");
}

// ── Private bucket (page images + payment slips) ─────────────────────────────
// New sensitive objects store the BARE KEY (e.g. "pages/<id>/1.webp"), not a URL,
// and are served only via getPresignedDownloadUrl. Legacy objects keep their full
// public URL and are still resolvable (until migrated), so nothing breaks.

export async function uploadToR2Private(
  key: string,
  body: Buffer,
  contentType: string
): Promise<string> {
  await r2Client.send(
    new PutObjectCommand({ Bucket: PRIVATE_BUCKET, Key: key, Body: body, ContentType: contentType })
  );
  return key; // store the key; read it back through getPresignedDownloadUrl
}

export async function getPresignedUploadUrlPrivate(
  key: string,
  contentType: string
): Promise<string> {
  return getSignedUrl(
    r2Client,
    new PutObjectCommand({ Bucket: PRIVATE_BUCKET, Key: key, ContentType: contentType }),
    { expiresIn: 3600 }
  );
}

// Resolve a stored image reference to its bucket + key. A full http(s) URL is a
// legacy public object; anything else is a bare key in the private bucket.
function resolveStored(stored: string): { bucket: string; key: string } {
  if (/^https?:\/\//i.test(stored)) {
    return { bucket: BUCKET, key: stored.replace(`${PUBLIC_URL}/`, "") };
  }
  return { bucket: PRIVATE_BUCKET, key: stored };
}

/** Short-lived presigned GET URL for a stored image (private or legacy public). */
export async function getPresignedDownloadUrl(stored: string, expiresIn = 120): Promise<string> {
  const { bucket, key } = resolveStored(stored);
  return getSignedUrl(r2Client, new GetObjectCommand({ Bucket: bucket, Key: key }), { expiresIn });
}
