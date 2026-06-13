import { ImageResponse } from "next/og";
import { loadThaiFont } from "@/lib/og";

// Brand cover/banner for social pages (Facebook 1640×624). Open /social/cover and save.
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
          justifyContent: "flex-start",
          textAlign: "center",
          paddingTop: 76,
          fontFamily: font ? "Noto Sans Thai" : "sans-serif",
        }}
      >
        {/* Content kept centered in the top ~half so neither the desktop
            (bottom-left) nor mobile (bottom-center) profile picture covers it,
            and it survives Facebook's mobile center-crop. */}
        <div style={{ fontSize: 26, letterSpacing: "0.42em", color: "#8a8a8a", display: "flex" }}>
          READ · CREATE · EARN
        </div>
        <div style={{ fontSize: 132, fontWeight: 700, letterSpacing: "0.01em", lineHeight: 1, marginTop: 16, display: "flex" }}>
          INKVERSE
        </div>
        <div style={{ fontSize: 34, color: "#dddddd", marginTop: 26, display: "flex" }}>
          อ่านมังงะ · มังฮวา · นิยาย แปลไทย
        </div>
        <div style={{ fontSize: 26, color: "#9a9a9a", marginTop: 12, display: "flex" }}>
          สนับสนุนนักเขียน รับ 80% · inkverse.com
        </div>
      </div>
    ),
    {
      width: 1640,
      height: 624,
      fonts: font ? [{ name: "Noto Sans Thai", data: font, weight: 700 as const, style: "normal" as const }] : [],
    }
  );
}
