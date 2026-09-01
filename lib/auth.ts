import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import * as Sentry from "@sentry/nextjs";
import { verifyAdminImpersonationToken } from "@/lib/admin-impersonation";
import { sendActivityDiscordWebhook } from "@/lib/discord";

const authSecret =
  process.env.AUTH_SECRET ||
  process.env.NEXTAUTH_SECRET ||
  (process.env.NODE_ENV === "development"
    ? "dev-only-nextauth-secret-change-me"
    : undefined);

const passwordCredentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  twoFactorCode: z.string().optional(),
  backupCode: z.string().optional(),
});

const impersonationCredentialsSchema = z.object({
  impersonationToken: z.string().min(1),
});

const credentialsSchema = z.union([
  passwordCredentialsSchema,
  impersonationCredentialsSchema,
]);

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Credentials({
      async authorize(credentials) {
        try {
          const parsedCredentials = credentialsSchema.parse(credentials);

          if ("impersonationToken" in parsedCredentials) {
            const impersonation = await verifyAdminImpersonationToken(
              parsedCredentials.impersonationToken
            );

            if (!impersonation) {
              console.error("[AUTH] Invalid impersonation token");
              return null;
            }

            const adminUser = await prisma.user.findUnique({
              where: { id: impersonation.adminUserId },
              select: { id: true, role: true, tags: true },
            });

            if (
              !adminUser ||
              adminUser.role !== "ADMIN" ||
              adminUser.tags.includes("INACTIVE")
            ) {
              console.error("[AUTH] Impersonation denied: invalid admin context");
              return null;
            }

            const targetUser = await prisma.user.findUnique({
              where: { id: impersonation.targetUserId },
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                role: true,
                brokerageName: true,
                tags: true,
              },
            });

            if (!targetUser || targetUser.tags.includes("INACTIVE")) {
              console.error("[AUTH] Impersonation denied: target unavailable");
              return null;
            }

            return {
              id: targetUser.id,
              email: targetUser.email,
              name: `${targetUser.firstName} ${targetUser.lastName}`,
              role: targetUser.role,
              accountTitle: targetUser.tags.includes("PROPERTY_MANAGER")
                ? "Property Manager"
                : targetUser.tags.includes("SHARED_ACCOUNTANT")
                  ? "Accountant"
                : null,
              brokerageName: targetUser.brokerageName,
              emailVerifiedAt: new Date().toISOString(),
            };
          }

          const { email, password, twoFactorCode, backupCode } = parsedCredentials;
          const normalizedEmail = normalizeEmail(email);

          let user = await prisma.user.findUnique({
            where: { email },
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              role: true,
              brokerageName: true,
              passwordHash: true,
              tags: true,
              twoFactorEnabled: true,
              twoFactorSecret: true,
            },
          });

          if (!user && normalizedEmail !== email) {
            user = await prisma.user.findUnique({
              where: { email: normalizedEmail },
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                role: true,
                brokerageName: true,
                passwordHash: true,
                tags: true,
                twoFactorEnabled: true,
                twoFactorSecret: true,
              },
            });
          }

          if (!user) {
            user = await prisma.user.findFirst({
              where: {
                email: {
                  equals: normalizedEmail,
                  mode: "insensitive",
                },
              },
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                role: true,
                brokerageName: true,
                passwordHash: true,
                tags: true,
                twoFactorEnabled: true,
                twoFactorSecret: true,
              },
            });
          }

          if (!user) {
            console.error("[AUTH] User not found:", normalizedEmail);
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

          if (user.tags.includes("INACTIVE")) {
            console.error("[AUTH] Inactive account blocked:", email);
            return null;
          }

          if (user.role === "ADMIN" && user.twoFactorEnabled) {
            const {
              parseTwoFactorData,
              verifyAndConsumeBackupCode,
              verifyTotpCode,
              serializeTwoFactorData,
            } = await import("@/lib/two-factor");

            const stored = parseTwoFactorData(user.twoFactorSecret);
            if (!stored) {
              console.error("[AUTH] Admin 2FA is enabled but data is invalid for user:", email);
              return null;
            }

            const hasTotp = Boolean(twoFactorCode && twoFactorCode.trim().length > 0);
            const hasBackup = Boolean(backupCode && backupCode.trim().length > 0);

            if (!hasTotp && !hasBackup) {
              console.error("[AUTH] Missing admin 2FA code for user:", email);
              return null;
            }

            if (hasTotp) {
              const validTotp = await verifyTotpCode(stored.secret, twoFactorCode as string);
              if (!validTotp) {
                console.error("[AUTH] Invalid admin TOTP code for user:", email);
                return null;
              }
            } else {
              const consumed = await verifyAndConsumeBackupCode(backupCode as string, stored.backupCodeHashes);
              if (!consumed.valid) {
                console.error("[AUTH] Invalid admin backup code for user:", email);
                return null;
              }

              await prisma.user.update({
                where: { id: user.id },
                data: {
                  twoFactorSecret: serializeTwoFactorData({
                    secret: stored.secret,
                    backupCodeHashes: consumed.remainingHashes,
                    pending: false,
                    createdAt: stored.createdAt,
                  }),
                },
              });
            }
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

          if (user.role === "REALTOR") {
            await sendActivityDiscordWebhook({
              action: "REALTOR_LOGIN",
              description: `${user.firstName} ${user.lastName} logged in.`,
              actorName: `${user.firstName} ${user.lastName}`,
              actorEmail: user.email,
              actorRole: user.role,
              entityType: "User",
              entityId: user.id,
            }).catch((discordError) => {
              console.error("[DISCORD] Failed to send login webhook:", discordError);
            });
          }

          return {
            id: user.id,
            email: user.email,
            name: `${user.firstName} ${user.lastName}`,
            role: user.role,
            accountTitle: user.tags.includes("PROPERTY_MANAGER")
              ? "Property Manager"
              : user.tags.includes("SHARED_ACCOUNTANT")
                ? "Accountant"
              : null,
            brokerageName: user.brokerageName,
            // Legacy production DB may not have emailVerifiedAt yet.
            emailVerifiedAt: new Date().toISOString(),
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
        token.role = user.role;
        token.id = user.id;
        token.accountTitle = user.accountTitle || null;
        token.brokerageName = user.brokerageName || null;
        token.emailVerifiedAt = user.emailVerifiedAt || null;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.role = token.role!;
        session.user.id = token.id!;
        session.user.accountTitle = token.accountTitle || null;
        session.user.brokerageName = token.brokerageName || null;
        session.user.emailVerifiedAt = token.emailVerifiedAt || null;
        
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
