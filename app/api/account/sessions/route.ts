import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { apiError } from "@/lib/apiError";
import { listSessions } from "@/lib/deviceSessions";

// List the signed-in user's active device sessions, flagging the current one.
export async function GET(_req: NextRequest) {
  const session = await auth();
  if (!session?.user) return apiError("AUTH-007", 401);
  const userId = (session.user as { id: string }).id;

  // `sid` is populated once the Director wires it into the JWT/session; until
  // then it's undefined and nothing is flagged as current.
  const sid = (session.user as { sid?: string }).sid;

  const rows = await listSessions(userId);
  const sessions = rows.map((s) => ({ ...s, current: s.id === sid }));

  return NextResponse.json({ sessions });
}
