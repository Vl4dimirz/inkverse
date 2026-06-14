import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyImageToken } from "@/lib/imageToken";
import { getPresignedDownloadUrl } from "@/lib/r2";
import { rateLimit, clientIp } from "@/lib/rate-limit";

// Authenticated, signed image proxy. Manga page images are served through here
// instead of exposing the raw R2 URL. Each request must carry a valid, unexpired
// signature (?e&s) minted by the chapter reader after it passed access control,
// so URLs can't be forged or reused after the window — and a script can't bulk-
// grab predictable URLs. Rate-limited per IP. The reader loads these as blobs.
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  // Throttle bulk scraping — a human turns pages far slower than this.
  if (!rateLimit(`img:${clientIp(req)}`, 200, 60_000).ok) {
    return new NextResponse("Too Many Requests", { status: 429 });
  }

  const { id } = await params;
  const e = req.nextUrl.searchParams.get("e");
  const u = req.nextUrl.searchParams.get("u");
  const s = req.nextUrl.searchParams.get("s");

  // Signed + unexpired token is the access grant (minted post-authorization).
  if (!verifyImageToken(id, e, u, s)) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  // Behavioral throttle: the token binds the reader's id, so we can cap sustained
  // per-user volume. A human reading never pulls this many pages over 10 minutes;
  // a ripper grabbing whole series does. (Per-IP burst limit above still applies.)
  if (u && u !== "anon" && !rateLimit(`img:u:${u}`, 1200, 600_000).ok) {
    return new NextResponse("Too Many Requests", { status: 429 });
  }

  const page = await prisma.page.findUnique({ where: { id }, select: { imageUrl: true } });
  if (!page) return new NextResponse("Not found", { status: 404 });

  // Fetch from R2 via a short-lived presigned GET — works for both the private
  // bucket (new objects: bare key) and legacy public objects (full URL), so the
  // public bucket can be locked down without breaking already-uploaded pages.
  const upstream = await fetch(await getPresignedDownloadUrl(page.imageUrl));
  if (!upstream.ok || !upstream.body) return new NextResponse("Bad gateway", { status: 502 });

  return new NextResponse(upstream.body, {
    status: 200,
    headers: {
      "Content-Type": upstream.headers.get("content-type") || "image/jpeg",
      "Cache-Control": "private, max-age=3600",
      "X-Content-Type-Options": "nosniff",
      "X-Robots-Tag": "noindex",
    },
  });
}
