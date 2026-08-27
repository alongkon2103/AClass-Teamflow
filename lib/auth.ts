import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { headers } from "next/headers";
import { Role } from "@prisma/client";
import { authConfig } from "@/auth.config";
import { db } from "@/lib/db";
import { loginSchema } from "@/lib/validators/auth";
import { rateLimit } from "@/lib/rate-limit";
import { env } from "@/lib/env";
import type { Actor } from "@/lib/permissions";

/**
 * Auth.js only preserves the `code` of a CredentialsSignin subclass, so failure
 * reasons travel as codes and the UI maps them to Thai copy (see LOGIN_ERRORS).
 * Every credential failure uses the same generic message: never reveal whether
 * the email exists or the password was wrong.
 */
export const LOGIN_ERROR_CODES = {
  invalid: "invalid_credentials",
  rateLimited: "too_many_attempts",
} as const;

class InvalidCredentialsError extends CredentialsSignin {
  code = LOGIN_ERROR_CODES.invalid;
}

class TooManyAttemptsError extends CredentialsSignin {
  code = LOGIN_ERROR_CODES.rateLimited;
}

async function clientIp(): Promise<string> {
  const headerList = await headers();
  const forwarded = headerList.get("x-forwarded-for");
  // First entry is the originating client when behind a proxy.
  return forwarded?.split(",")[0]?.trim() ?? "unknown";
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        email: { label: "อีเมล", type: "email" },
        password: { label: "รหัสผ่าน", type: "password" },
      },
      async authorize(credentials) {
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) throw new InvalidCredentialsError();

        const ip = await clientIp();
        if (!rateLimit(`login:${ip}`, env.AUTH_RATE_LIMIT_MAX).allowed) {
          throw new TooManyAttemptsError();
        }

        const user = await db.user.findUnique({
          where: { email: parsed.data.email },
          select: {
            id: true,
            email: true,
            name: true,
            passwordHash: true,
            role: true,
            jobTitle: true,
            avatarColor: true,
            avatarUrl: true,
            isActive: true,
            mustChangePassword: true,
          },
        });

        // Always run a comparison so a missing user and a wrong password take
        // roughly the same time (avoids leaking which emails exist).
        const hash =
          user?.passwordHash ??
          "$2a$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidin";
        const passwordMatches = await bcrypt.compare(
          parsed.data.password,
          hash,
        );

        if (!user || !user.isActive || !passwordMatches) {
          throw new InvalidCredentialsError();
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          jobTitle: user.jobTitle,
          avatarColor: user.avatarColor,
          avatarUrl: user.avatarUrl,
          mustChangePassword: user.mustChangePassword,
        };
      },
    }),
  ],
});

/** Session user in the shape the permission layer expects. */
export async function getCurrentUser() {
  const session = await auth();
  return session?.user ?? null;
}

/** Throws when unauthenticated; use in server actions and services. */
export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) throw new Error("กรุณาเข้าสู่ระบบ");
  return user;
}

/** Throws unless the signed-in user holds the given role. */
export async function requireRole(role: Role) {
  const user = await requireUser();
  if (user.role !== role) throw new Error("คุณไม่มีสิทธิ์เข้าถึงส่วนนี้");
  return user;
}

/** Narrow the session user down to the RBAC actor shape. */
export async function requireActor(): Promise<Actor> {
  const user = await requireUser();
  return { id: user.id, role: user.role };
}
