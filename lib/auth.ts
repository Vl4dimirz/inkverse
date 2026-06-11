import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import type { Adapter, AdapterUser } from "next-auth/adapters";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { authConfig } from "./auth.config";
import { rateLimit } from "@/lib/rate-limit";
import { grantSignupBonus } from "@/lib/coins";

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
        emailVerified: data.emailVerified ?? null,
        role: "READER",
      },
    });
    // Welcome coins for new Google sign-ups (idempotent).
    await grantSignupBonus(user.id);
    return user as AdapterUser;
  },
};

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter,
  callbacks: {
    ...authConfig.callbacks,
    async jwt({ token, user }) {
      if (user) {
        token.role = (user as { role?: string }).role;
        token.id = user.id;
        token.username = (user as { username?: string }).username ?? user.name ?? undefined;
      }
      // Refresh role + username from the DB on every token use, so changes made
      // server-side (e.g. a writer application being approved → role TRANSLATOR)
      // take effect immediately without the user having to sign out and back in.
      if (token.id) {
        const u = await prisma.user.findUnique({
          where: { id: token.id as string },
          select: { username: true, role: true },
        });
        if (u) {
          token.username = u.username;
          token.role = u.role;
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as { role?: string }).role = token.role as string;
        (session.user as { id?: string }).id = token.id as string;
        (session.user as { username?: string }).username = token.username as string;
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
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
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
        return {
          id: user.id,
          email: user.email,
          name: user.username,
          image: user.avatarUrl,
          role: user.role,
        };
      },
    }),
  ],
});
