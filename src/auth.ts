import NextAuth, { CredentialsSignin } from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { resolveDatabaseConnectionString } from "@/lib/database-url";
import type { UserRole } from "@/generated/prisma/enums";
import { loginSchema } from "@/lib/validators/auth";
import { authConfig } from "@/auth.config";
import { ensureDemoUsers } from "@/lib/bootstrap-users";
import { mockAuthenticate, shouldUseMockAuth } from "@/lib/mock-auth";

class EmailNotVerifiedError extends CredentialsSignin {
  code = "email_not_verified";
}

class DatabaseUnavailableError extends CredentialsSignin {
  code = "database_unavailable";
}

function isDatabaseUnavailable(error: unknown) {
  if (!(error instanceof Error)) return false;

  const message = error.message.toLowerCase();
  return [
    "database_url is not configured",
    "econnrefused",
    "p1001",
    "p1002",
    "can't reach database",
    "connection terminated",
    "connection timeout",
  ].some((fragment) => message.includes(fragment));
}

function isSmtpConfigured() {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER);
}

const googleConfigured =
  Boolean(process.env.GOOGLE_CLIENT_ID) &&
  Boolean(process.env.GOOGLE_CLIENT_SECRET);

const hasDatabase = Boolean(resolveDatabaseConnectionString());

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  trustHost: true,
  secret:
    process.env.AUTH_SECRET ??
    process.env.NEXTAUTH_SECRET ??
    "development-secret-key-change-in-production",
  ...(hasDatabase ? { adapter: PrismaAdapter(db) } : {}),
  providers: [
    ...(googleConfigured
      ? [
          Google({
            clientId: process.env.GOOGLE_CLIENT_ID!,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
            allowDangerousEmailAccountLinking: true,
          }),
        ]
      : []),
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const email = String(credentials?.email ?? "").trim().toLowerCase();
        const password = String(credentials?.password ?? "");
        const parsed = loginSchema.safeParse({ email, password });
        if (!parsed.success) return null;

        try {
          await ensureDemoUsers();
          const user = await db.user.findUnique({
            where: { email: parsed.data.email },
          });

          if (!user?.passwordHash || user.deletedAt || !user.isActive) {
            if (process.env.NODE_ENV !== "production" && shouldUseMockAuth()) {
              const mockResult = await mockAuthenticate(
                parsed.data.email,
                parsed.data.password
              );
              if (mockResult.success && "user" in mockResult) {
                return {
                  ...mockResult.user,
                  role: mockResult.user.role as UserRole,
                };
              }
            }
            return null;
          }

          const valid = await bcrypt.compare(
            parsed.data.password,
            user.passwordHash
          );
          if (!valid) {
            if (process.env.NODE_ENV !== "production" && shouldUseMockAuth()) {
              const mockResult = await mockAuthenticate(
                parsed.data.email,
                parsed.data.password
              );
              if (mockResult.success && "user" in mockResult) {
                return {
                  ...mockResult.user,
                  role: mockResult.user.role as UserRole,
                };
              }
            }
            return null;
          }

          if (!user.emailVerified) {
            if (!isSmtpConfigured()) {
              await db.user.update({
                where: { id: user.id },
                data: { emailVerified: new Date() },
              });
            } else {
              throw new EmailNotVerifiedError();
            }
          }

          return {
            id: user.id,
            email: user.email,
            name: user.name,
            image: user.image,
            role: user.role,
          };
        } catch (error) {
          if (error instanceof EmailNotVerifiedError) throw error;
          
          if (isDatabaseUnavailable(error)) {
            console.error("[auth:credentials] Database connection failed:", error);

            if (process.env.NODE_ENV !== "production" && shouldUseMockAuth()) {
              const mockResult = await mockAuthenticate(
                parsed.data.email,
                parsed.data.password
              );

              if (mockResult.success && "user" in mockResult) {
                return {
                  ...mockResult.user,
                  role: mockResult.user.role as UserRole,
                };
              }

              return null;
            }

            throw new DatabaseUnavailableError();
          }
          
          console.error("[auth:credentials]", error);
          return null;
        }
      },
    }),
  ],
  callbacks: {
    ...authConfig.callbacks,
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id!;
        token.role = (user as { role?: UserRole }).role ?? "RESIDENT";
      }

      if (trigger === "update" && session?.role) {
        token.role = session.role as UserRole;
      }

      if (token.id && !token.role) {
        try {
          const dbUser = await db.user.findUnique({
            where: { id: token.id as string },
            select: { role: true },
          });
          token.role = dbUser?.role ?? "RESIDENT";
        } catch (error) {
          console.error("[auth:jwt]", error);
          token.role = "RESIDENT";
        }
      }

      return token;
    },
    async signIn({ user, account }) {
      if (account?.provider === "google" && user.email) {
        const existing = await db.user.findUnique({
          where: { email: user.email.toLowerCase() },
        });
        if (existing && !existing.isActive) return false;

        if (existing && !existing.emailVerified) {
          await db.user.update({
            where: { id: existing.id },
            data: { emailVerified: new Date() },
          });
        }

        if (!existing) {
          const created = await db.user.create({
            data: {
              email: user.email.toLowerCase(),
              name: user.name,
              image: user.image,
              emailVerified: new Date(),
              role: "RESIDENT",
            },
          });
          await db.residentProfile.create({
            data: { userId: created.id },
          });
          await db.rewardWallet.create({
            data: { residentId: created.id },
          });
        }
      }
      return true;
    },
  },
  events: {
    async createUser({ user }) {
      if (!user.id) return;
      const profile = await db.residentProfile.findUnique({
        where: { userId: user.id },
      });
      if (!profile) {
        await db.residentProfile.create({ data: { userId: user.id } });
        await db.rewardWallet.create({ data: { residentId: user.id } });
      }
    },
  },
});
