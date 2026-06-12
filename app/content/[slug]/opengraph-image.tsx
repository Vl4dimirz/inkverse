import { ImageResponse } from "next/og";
import { prisma } from "@/lib/prisma";

// nodejs (NOT edge): Prisma uses the pg adapter which is not edge-compatible.
export const runtime = "nodejs";
export const alt = "INKVERSE";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Bundled Thai+Latin font (variable Noto Sans Thai) — reliable, no CDN dependency.
// Loaded lazily (at request time, not build time) and cached per instance.
let fontCache: ArrayBuffer | null = null;
async function getFont(): Promise<ArrayBuffer> {
  if (fontCache) return fontCache;
  const data = await fetch(new URL("./noto-thai.ttf", import.meta.url)).then((r) => r.arrayBuffer());
  fontCache = data;
  return data;
}

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [manga, fontData] = await Promise.all([
    prisma.manga.findUnique({ where: { slug }, select: { title: true, coverUrl: true, type: true } }),
    getFont(),
  ]);

  const title = manga?.title || "INKVERSE";
  const type = manga?.type || "";
  const cover = manga?.coverUrl || null;

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: "#0a0a0a", color: "#ffffff", fontFamily: "NotoThai" }}>
        {cover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={cover} alt="" width={410} height={630} style={{ width: 410, height: 630, objectFit: "cover" }} />
        ) : (
          <div style={{ width: 410, height: 630, background: "#161616" }} />
        )}

        <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "space-between", padding: 60 }}>
          <div style={{ display: "flex", flexDirection: "column" }}>
            {type ? (
              <div style={{ alignSelf: "flex-start", background: "#ffffff", color: "#0a0a0a", fontSize: 22, fontWeight: 700, padding: "6px 18px", letterSpacing: 3, marginBottom: 30, display: "flex" }}>
                {type}
              </div>
            ) : null}
            <div style={{ fontSize: title.length > 38 ? 50 : 64, fontWeight: 700, lineHeight: 1.15, display: "flex" }}>
              {title.length > 72 ? title.slice(0, 72) + "…" : title}
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: 26, color: "#bdbdbd", marginBottom: 12, display: "flex" }}>อ่านมังงะ &amp; นิยายแปลไทย ฟรี</div>
            <div style={{ fontSize: 46, fontWeight: 700, letterSpacing: 8, display: "flex" }}>INKVERSE</div>
          </div>
        </div>
      </div>
    ),
    { ...size, fonts: [{ name: "NotoThai", data: fontData, weight: 700 as const, style: "normal" as const }] }
  );
}
