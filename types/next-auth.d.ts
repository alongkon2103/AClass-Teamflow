import type { Role } from "@prisma/client";
import type { DefaultSession } from "next-auth";

// Carry the app-specific fields on the session/JWT so server components and
// actions can authorize without an extra database round-trip.
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      // Narrowed from DefaultSession, where both are optional: the credentials
      // provider always returns them, so the app can rely on them being present.
      name: string;
      email: string;
      role: Role;
      jobTitle: string | null;
      avatarColor: string;
      avatarUrl: string | null;
      mustChangePassword: boolean;
    } & DefaultSession["user"];
  }

  interface User {
    role: Role;
    jobTitle: string | null;
    avatarColor: string;
    avatarUrl: string | null;
    mustChangePassword: boolean;
  }
}

// The JWT itself is typed in auth.config.ts: @auth/core/jwt cannot be augmented
// from here because pnpm keeps that transitive package out of top-level node_modules.
