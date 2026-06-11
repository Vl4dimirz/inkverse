import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getMessaging } from "firebase-admin/messaging";
import { prisma } from "./prisma";

// Push is optional: if FIREBASE_SERVICE_ACCOUNT isn't set, every call no-ops so
// the web deploy keeps working without any Firebase setup.
let ready: boolean | null = null;
function ensureApp(): boolean {
  if (ready !== null) return ready;
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) { ready = false; return false; }
  try {
    if (!getApps().length) {
      initializeApp({ credential: cert(JSON.parse(raw)) });
    }
    ready = true;
  } catch {
    ready = false;
  }
  return ready;
}

/** Send a notification to every device of the given users. Prunes dead tokens. */
export async function sendPushToUsers(
  userIds: string[],
  title: string,
  body: string,
  link = "/"
): Promise<void> {
  if (!ensureApp() || userIds.length === 0) return;
  const rows = await prisma.pushToken.findMany({
    where: { userId: { in: userIds } },
    select: { token: true },
  });
  const tokens = [...new Set(rows.map((r) => r.token))];
  if (tokens.length === 0) return;

  try {
    const res = await getMessaging().sendEachForMulticast({
      tokens,
      notification: { title, body },
      data: { link },
      android: { priority: "high", notification: { sound: "default" } },
    });
    const dead: string[] = [];
    res.responses.forEach((r, i) => {
      const code = r.success ? "" : r.error?.code ?? "";
      if (
        code.includes("registration-token-not-registered") ||
        code.includes("invalid-argument") ||
        code.includes("invalid-registration-token")
      ) {
        dead.push(tokens[i]);
      }
    });
    if (dead.length) await prisma.pushToken.deleteMany({ where: { token: { in: dead } } });
  } catch {
    /* non-critical — never block the request that triggered it */
  }
}
