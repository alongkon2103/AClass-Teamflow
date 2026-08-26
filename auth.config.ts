import type { NextAuthConfig } from "next-auth";
import type { Role } from "@prisma/client";

/**
 * Edge-safe Auth.js configuration. Middleware runs on the edge runtime, which
 * cannot load bcrypt or Prisma — so the Credentials provider (and anything else
 * Node-only) lives in lib/auth.ts and is merged in there.
 */

/** App fields carried on the JWT. */
type AppTokenFields = {
  id: string;
  role: Role;
  jobTitle: string | null;
  avatarColor: string;
  mustChangePassword: boolean;
};

/**
 * Auth.js types the JWT as `Record<string, unknown>`, and augmenting
 * `@auth/core/jwt` is not possible here because pnpm keeps it out of the
 * top-level node_modules. Reading through this view keeps the callbacks typed
 * without resorting to `any`.
 */
const appFields = (token: Record<string, unknown>) =>
  token as Record<string, unknown> & AppTokenFields;

export const authConfig = {
  /**
   * Auth.js refuses requests from an unrecognised Host in production unless the
   * host is trusted. TeamFlow is self-hosted behind a reverse proxy/tunnel, so
   * the forwarded host is the real one — without this, every sign-in fails in
   * production with UntrustedHost while working fine in development.
   * Set AUTH_URL as well so generated callback URLs are absolute and correct.
   */
  trustHost: true,
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  providers: [],
  callbacks: {
    // Copy app fields onto the token at sign-in; later calls just pass it through.
    jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.jobTitle = user.jobTitle;
        token.avatarColor = user.avatarColor;
        token.mustChangePassword = user.mustChangePassword;
      }
      // Lets the app clear the flag after a password change without re-login.
      if (
        trigger === "update" &&
        session &&
        typeof session === "object" &&
        "mustChangePassword" in session &&
        session.mustChangePassword === false
      ) {
        token.mustChangePassword = false;
      }
      return token;
    },
    session({ session, token }) {
      const fields = appFields(token);
      if (session.user) {
        session.user.id = fields.id;
        session.user.role = fields.role;
        session.user.jobTitle = fields.jobTitle;
        session.user.avatarColor = fields.avatarColor;
        session.user.mustChangePassword = fields.mustChangePassword;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
