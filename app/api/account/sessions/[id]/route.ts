import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { apiError } from "@/lib/apiError";
import { revokeSession } from "@/lib/deviceSessions";

type Params = { params: Promise<{ id: string }> };

// Revoke (log out) a single device session. Ownership-scoped in revokeSession.
export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user) return apiError("AUTH-007", 401);
  const userId = (session.user as { id: string }).id;

  const { id } = await params;
  await revokeSession(userId, id);

  return NextResponse.json({ ok: true });
}
