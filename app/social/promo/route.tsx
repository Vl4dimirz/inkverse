import { ImageResponse } from "next/og";
import { loadThaiFont } from "@/lib/og";

// Square promo image for social posts (1080×1080, ideal for Facebook feed).
// Open /social/promo and save the PNG to attach to a post.
export const runtime = "nodejs";

export async function GET() {
  const font = await loadThaiFont();
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: "#000000",
          color: "#ffffff",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "0 80px",
          position: "relative",
          fontFamily: font ? "Noto Sans Thai" : "sans-serif",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: 48,
            left: 48,
            right: 48,
            bottom: 48,
            border: "2px solid rgba(255,255,255,0.16)",
            display: "flex",
          }}
        />
        <div style={{ fontSize: 34, letterSpacing: "0.42em", color: "#9a9a9a", display: "flex" }}>
          อ่านฟรี · แปลไทย
        </div>
        <div style={{ fontSize: 150, fontWeight: 700, letterSpacing: "-0.01em", lineHeight: 1, marginTop: 26, display: "flex" }}>
          INKVERSE
        </div>
        <div style={{ fontSize: 46, color: "#ffffff", marginTop: 42, display: "flex" }}>
          มังงะ · มังฮวา · นิยาย แปลไทย
        </div>
        <div style={{ fontSize: 30, color: "#8a8a8a", marginTop: 18, display: "flex" }}>
          แอ็กชัน · แฟนตาซี · มูริม · เกิดใหม่ · โรแมนซ์
        </div>
        <div style={{ marginTop: 58, display: "flex", border: "2px solid #ffffff", padding: "16px 42px" }}>
          <div style={{ fontSize: 40, fontWeight: 700, letterSpacing: "0.08em", display: "flex" }}>
            inksverse.com
          </div>
        </div>
      </div>
    ),
    {
      width: 1080,
      height: 1080,
      fonts: font ? [{ name: "Noto Sans Thai", data: font, weight: 700 as const, style: "normal" as const }] : [],
    }
  );
}
