import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { unlockChapter } from "@/lib/coins";
import { maybeNotifyLowCoins } from "@/lib/notifications";
import { apiError } from "@/lib/apiError";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return apiError("AUTH-007", 401);
  }

  const body = await req.json().catch(() => null);
  const chapterId = body?.chapterId as string | undefined;
  if (!chapterId) {
    return apiError("VAL-001", 400);
  }

  const userId = (session.user as { id: string }).id;
  const result = await unlockChapter(userId, chapterId);

  if (!result.success) {
    // Keep `error` (client may switch on it) and add a code.
    if (result.error === "INSUFFICIENT_COINS")
      return NextResponse.json({ error: result.error, code: "COIN-001" }, { status: 402 });
    if (result.error === "NOT_FOUND")
      return NextResponse.json({ error: result.error, code: "READ-001" }, { status: 404 });
    return NextResponse.json({ error: result.error, code: "COIN-005" }, { status: 400 });
  }

  await maybeNotifyLowCoins(userId, result.coinsLeft);
  return NextResponse.json(result);
}
