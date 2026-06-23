import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { apiError } from "@/lib/apiError";
import { revokeOthers } from "@/lib/deviceSessions";

// "Log out everywhere else": revoke every session except the current device.
export async function POST(_req: NextRequest) {
  const session = await auth();
  if (!session?.user) return apiError("AUTH-007", 401);
  const userId = (session.user as { id: string }).id;

  // When sid isn't wired yet, keepSid = "" → revokes ALL sessions (safe default,
  // user simply has to log back in on the current device too).
  const sid = (session.user as { sid?: string }).sid ?? "";
  const count = await revokeOthers(userId, sid);

  return NextResponse.json({ ok: true, count });
}
