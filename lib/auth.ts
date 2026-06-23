import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import type { Adapter, AdapterUser } from "next-auth/adapters";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { OAuth2Client } from "google-auth-library";
import { authConfig } from "./auth.config";
import { rateLimit } from "@/lib/rate-limit";
import { createUserSession, sessionValid, touchSession } from "@/lib/deviceSessions";
import { verifyTotp, verifyBackupCode } from "@/lib/twoFactor";

// Pull device info from the sign-in request (for the device/session list).
function reqInfo(req: Request | undefined) {
  return {
    userAgent: req?.headers?.get("user-agent") ?? null,
    ip: req?.headers?.get("x-forwarded-for")?.split(",")[0]?.trim() || null,
  };
}

const googleVerifier = new OAuth2Client();

// Find (or first-time create) a user from a verified Google identity. Used by the
// native-app Google sign-in, which can't go through the OAuth adapter flow. Keyed
// by email so it lands on the same account as web Google sign-in.
async function findOrCreateGoogleUser(p: {
  email: string;
  name?: string | null;
  picture?: string | null;
}) {
  const email = p.email.toLowerCase();
  let user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    const seed =
      email.split("@")[0].replace(/[^a-zA-Z0-9_]/g, "").slice(0, 20) || "user";
    let username = seed;
    while (await prisma.user.findUnique({ where: { username } })) {
      username = `${seed}${Math.floor(1000 + Math.random() * 9000)}`;
    }
    user = await prisma.user.create({
      data: {
        email,
        username,
        name: p.name ?? null,
        image: p.picture ?? null,
        avatarUrl: p.picture ?? null,
        emailVerified: new Date(), // Google already verified the inbox
        role: "READER",
      },
    });
  }
  return user;
}

// Our User model has a required, unique `username` that the default adapter
// doesn't provide on OAuth sign-up. Wrap createUser to synthesise a unique
// username (and mirror the avatar into avatarUrl) so Google sign-in works.
const adapter: Adapter = {
  ...PrismaAdapter(prisma),
  createUser: async (data) => {
    const seed =
      (data.email?.split("@")[0] || "user").replace(/[^a-zA-Z0-9_]/g, "").slice(0, 20) ||
      "user";
    let username = seed;
    while (await prisma.user.findUnique({ where: { username } })) {
      username = `${seed}${Math.floor(1000 + Math.random() * 9000)}`;
    }
    const user = await prisma.user.create({
      data: {
        email: data.email!,
        username,
        name: data.name ?? null,
        image: data.image ?? null,
        avatarUrl: data.image ?? null,
        // OAuth (Google) sign-up: the provider already verified inbox ownership.
        emailVerified: new Date(),
        role: "READER",
      },
    });
    return user as AdapterUser;
  },
};

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter,
  callbacks: {
    ...authConfig.callbacks,
    async jwt({ token, user, trigger }) {
      if (user) {
        token.role = (user as { role?: string }).role;
        token.id = user.id;
        token.username = (user as { username?: string }).username ?? user.name ?? undefined;
        // Google sign-in has no `remember` field → default to "remembered".
        token.remember = (user as { remember?: boolean }).remember !== false;
        token.loginAt = Date.now();
        token.refreshedAt = Date.now(); // login data is fresh — skip refresh for a bit
        // Device session id: credentials providers set it in authorize; the web
        // Google (adapter) path doesn't, so create one here (no req headers).
        token.sid = (user as { sid?: string }).sid;
        if (!token.sid && user.id) token.sid = await createUserSession(user.id, {});
      }
      // Refresh role + username from the DB at most once a minute (not on every
      // request) so an approved writer becomes TRANSLATOR within ~60s without a
      // re-login, while we avoid a DB round-trip on every page view / API poll —
      // that query sat on the critical path of literally every authed request.
      if (token.id) {
        const now = Date.now();
        const last = typeof token.refreshedAt === "number" ? token.refreshedAt : 0;
        // `trigger === "update"` = a client called useSession().update() (e.g. right
        // after creator auto-approval) — refresh the role NOW, bypassing the 60s
        // throttle, so a just-approved creator can enter /dashboard immediately.
        if (trigger === "update" || now - last > 60_000) {
          // Device revocation: if this token's session row was deleted ("log out
          // this device" / "log out everywhere"), neuter the token → logged out.
          // Throttled to ~60s so it isn't a DB hit on every request.
          if (token.sid && !(await sessionValid(token.sid as string))) {
            return {};
          }
          const u = await prisma.user.findUnique({
            where: { id: token.id as string },
            select: { username: true, role: true },
          });
          if (u) {
            token.username = u.username;
            token.role = u.role;
          }
          if (token.sid) await touchSession(token.sid as string);
          token.refreshedAt = now;
        }
      }
      return token;
    },
    async session({ session, token }) {
      // Token was neutered (device revoked) → present as logged out.
      if (!token.id) {
        (session as { user?: unknown }).user = undefined;
        return session;
      }
      if (session.user) {
        (session.user as { role?: string }).role = token.role as string;
        (session.user as { id?: string }).id = token.id as string;
        (session.user as { username?: string }).username = token.username as string;
        (session.user as { sid?: string }).sid = token.sid as string | undefined;
      }
      // "Remember me" unticked → expire the session 1 day after login instead of
      // the default 30 days. We shorten session.expires so the client treats the
      // login as ended (the JWT cookie itself still falls back to the 30d max).
      if (token.remember === false && typeof token.loginAt === "number") {
        const shortExp = new Date(token.loginAt + 24 * 60 * 60_000);
        if (shortExp < new Date(session.expires)) {
          session.expires = shortExp.toISOString() as typeof session.expires;
        }
      }
      return session;
    },
  },
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      // Google verifies email ownership, so it's safe here: a Google sign-in
      // links to an existing account with the same email instead of throwing
      // OAuthAccountNotLinked.
      allowDangerousEmailAccountLinking: true,
    }),
    // Native Google sign-in (Android app): the app does the Google account picker
    // natively and posts the resulting idToken here. We verify it server-side and
    // establish the same JWT session as any other login.
    CredentialsProvider({
      id: "google-native",
      name: "Google",
      credentials: { idToken: { label: "idToken", type: "text" } },
      async authorize(credentials, req) {
        const idToken = credentials?.idToken as string | undefined;
        if (!idToken) return null;
        try {
          const ticket = await googleVerifier.verifyIdToken({
            idToken,
            audience: process.env.GOOGLE_CLIENT_ID,
          });
          const payload = ticket.getPayload();
          if (!payload?.email || payload.email_verified === false) return null;
          const user = await findOrCreateGoogleUser({
            email: payload.email,
            name: payload.name,
            picture: payload.picture,
          });
          const sid = await createUserSession(user.id, reqInfo(req as Request | undefined));
          return {
            id: user.id,
            email: user.email,
            name: user.username,
            image: user.avatarUrl,
            role: user.role,
            remember: true,
            sid,
          };
        } catch {
          return null;
        }
      },
    }),
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
        remember: { label: "Remember", type: "text" },
        totp: { label: "2FA", type: "text" },
      },
      async authorize(credentials, req) {
        if (!credentials?.email || !credentials?.password) return null;

        // Throttle password guesses per account (brute-force protection).
        const email = (credentials.email as string).toLowerCase();
        if (!rateLimit(`login:${email}`, 5, 5 * 60_000).ok) return null;

        const user = await prisma.user.findUnique({
          where: { email: credentials.email as string },
        });
        if (!user || !user.passwordHash) return null;
        const valid = await bcrypt.compare(
          credentials.password as string,
          user.passwordHash
        );
        if (!valid) return null;
        // Require a verified email for password logins. This closes the
        // pre-account-hijacking vector: a password account pre-registered for
        // someone else's email is useless (can't log in) even after a Google
        // sign-in links to it. Existing users were grandfathered to verified.
        if (!user.emailVerified) return null;

        // Two-factor gate: a 2FA-enabled account must supply a valid TOTP code
        // (or a one-time backup code) on top of the password.
        if (user.twoFactorEnabled) {
          const code = (credentials.totp as string | undefined)?.trim();
          if (!code) return null;
          let ok = user.twoFactorSecret ? verifyTotp(user.twoFactorSecret, code) : false;
          if (!ok) {
            const r = await verifyBackupCode(user.twoFactorBackupCodes, code);
            if (r.ok) {
              ok = true;
              await prisma.user.update({
                where: { id: user.id },
                data: { twoFactorBackupCodes: r.remainingJson },
              });
            }
          }
          if (!ok) return null;
        }

        const sid = await createUserSession(user.id, reqInfo(req as Request | undefined));
        return {
          id: user.id,
          email: user.email,
          name: user.username,
          image: user.avatarUrl,
          role: user.role,
          // "Remember me" unticked → a short-lived session (see jwt/session below).
          remember: credentials.remember !== "0" && credentials.remember !== "false",
          sid,
        };
      },
    }),
  ],
});
