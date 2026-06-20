import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import * as Sentry from "@sentry/nextjs";

const authSecret =
  process.env.NEXTAUTH_SECRET ||
  (process.env.NODE_ENV === "development"
    ? "dev-only-nextauth-secret-change-me"
    : undefined);

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Credentials({
      async authorize(credentials) {
        try {
          const { email, password } = credentialsSchema.parse(credentials);

          const user = await prisma.user.findUnique({
            where: { email },
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              role: true,
              brokerageName: true,
              passwordHash: true,
            },
          });

          if (!user) {
            console.error("[AUTH] User not found:", email);
            return null;
          }

          const isPasswordValid = await bcrypt.compare(
            password,
            user.passwordHash
          );

          if (!isPasswordValid) {
            console.error("[AUTH] Invalid password for user:", email);
            return null;
          }

          // Best-effort write so auth still succeeds if runtime DB lags schema.
          try {
            await prisma.user.update({
              where: { id: user.id },
              data: { lastLoginAt: new Date() },
            });
          } catch (loginUpdateError: any) {
            console.warn(
              "[AUTH] Failed to update lastLoginAt:",
              loginUpdateError?.message || loginUpdateError
            );
          }

          return {
            id: user.id,
            email: user.email,
            name: `${user.firstName} ${user.lastName}`,
            role: user.role,
            brokerageName: user.brokerageName,
            emailVerifiedAt: null,
          };
        } catch (error: any) {
          console.error("[AUTH] Authorization error:", error?.message || error);
          Sentry.captureException(error, {
            tags: { component: "auth-credentials" },
          });
          return null;
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = (user as any).role;
        token.id = user.id;
        token.brokerageName = (user as any).brokerageName || null;
        token.emailVerifiedAt = (user as any).emailVerifiedAt || null;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).role = token.role;
        (session.user as any).id = token.id;
        (session.user as any).brokerageName = (token as any).brokerageName || null;
        (session.user as any).emailVerifiedAt = (token as any).emailVerifiedAt || null;
        
        // Set Sentry user context
        Sentry.setUser({
          id: String(token.id),
          email: session.user.email || undefined,
          username: session.user.name || undefined,
          ip_address: "{{auto}}",
        });
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  secret: authSecret,
});
