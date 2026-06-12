import { NextResponse } from "next/server";
import { LATEST_APK } from "@/lib/appVersion";

// The installed app polls this to learn the newest published APK. Updates on each
// deploy (no app rebuild needed to change what's "latest").
export const dynamic = "force-static";

export function GET() {
  return NextResponse.json(LATEST_APK);
}
