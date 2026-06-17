import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import sharp from "sharp";
import { decodeSlug } from "@/lib/slug";

// Downloadable promo card for creators to post on IG / TikTok / FB — where links
// aren't clickable, so the image itself must carry the title + "find it on
// INKVERSE". Two formats: square (1080) for feeds, story (1080x1920) for
// stories/TikTok. Reuses the OG-image rendering approach.
export const runtime = "nodejs";

async function coverPng(url: string | null, w: number, h: number): Promise<string | null> {
  if (!url) return null;
  try {
    const res = await fetch(url, { cache: "force-cache" });
    if (!res.ok) return null;
    const png = await sharp(Buffer.from(await res.arrayBuffer())).resize(w, h, { fit: "cover" }).png().toBuffer();
    return `data:image/png;base64,${png.toString("base64")}`;
  } catch {
    return null;
  }
}

let fontsCache: { name: string; data: ArrayBuffer; weight: 700; style: "normal" }[] | null = null;
async function getFonts() {
  if (fontsCache) return fontsCache;
  const fetchFont = async (u: string) => {
    try { const r = await fetch(u, { cache: "force-cache" }); return r.ok ? await r.arrayBuffer() : null; } catch { return null; }
  };
  const [thai, latin] = await Promise.all([
    fetchFont("https://cdn.jsdelivr.net/npm/@fontsource/noto-sans-thai@5/files/noto-sans-thai-thai-700-normal.woff"),
    fetchFont("https://cdn.jsdelivr.net/npm/@fontsource/noto-sans@5/files/noto-sans-latin-700-normal.woff"),
  ]);
  const fonts: { name: string; data: ArrayBuffer; weight: 700; style: "normal" }[] = [];
  if (latin) fonts.push({ name: "NotoLatin", data: latin, weight: 700, style: "normal" });
  if (thai) fonts.push({ name: "NotoThai", data: thai, weight: 700, style: "normal" });
  fontsCache = fonts;
  return fonts;
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug: rawSlug } = await params;
  const slug = decodeSlug(rawSlug);
  const story = new URL(req.url).searchParams.get("format") === "story";
  const W = 1080, H = story ? 1920 : 1080;
  const coverW = story ? 620 : 480;
  const coverH = Math.round(coverW * 1.5);

  const [manga, fonts] = await Promise.all([
    prisma.manga.findUnique({ where: { slug }, select: { title: true, coverUrl: true, type: true } }),
    getFonts(),
  ]);
  if (!manga) return new Response("not found", { status: 404 });

  const title = manga.title;
  const type = manga.type === "NOVEL" ? "นิยาย" : manga.type;
  const cover = await coverPng(manga.coverUrl, coverW, coverH);
  const family = "NotoThai, NotoLatin, sans-serif";
  const titleSize = title.length > 40 ? (story ? 58 : 52) : (story ? 80 : 66);

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "space-between", background: "#0a0a0a", color: "#fff", fontFamily: family, padding: story ? 80 : 64 }}>
        {/* brand */}
        <div style={{ display: "flex", fontSize: story ? 40 : 34, fontWeight: 700, letterSpacing: 10 }}>INKVERSE</div>

        {/* cover + title */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
          {cover ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={cover} alt="" width={coverW} height={coverH} style={{ width: coverW, height: coverH, objectFit: "cover", border: "4px solid #fff" }} />
          ) : (
            <div style={{ width: coverW, height: coverH, background: "#161616" }} />
          )}
          <div style={{ display: "flex", background: "#fff", color: "#0a0a0a", fontSize: story ? 26 : 22, fontWeight: 700, padding: "6px 20px", letterSpacing: 3, marginTop: story ? 44 : 32 }}>{type}</div>
          <div style={{ display: "flex", textAlign: "center", fontSize: titleSize, fontWeight: 700, lineHeight: 1.12, marginTop: 22, maxWidth: W - 140 }}>
            {title.length > 64 ? title.slice(0, 64) + "…" : title}
          </div>
        </div>

        {/* CTA — links don't click on IG/TikTok, so tell them how to find it */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
          <div style={{ display: "flex", fontSize: story ? 34 : 28, color: "#dcdcdc" }}>อ่านฟรีทุกตอน — ค้นชื่อนี้ได้เลยที่</div>
          <div style={{ display: "flex", fontSize: story ? 52 : 44, fontWeight: 700, letterSpacing: 4, marginTop: 10 }}>inksverse.com</div>
        </div>
      </div>
    ),
    { width: W, height: H, fonts }
  );
}
