import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "@/auth.config";

// Edge-safe instance: authConfig has no Node-only providers, so middleware can
// read the JWT without pulling in bcrypt/Prisma.
const { auth } = NextAuth(authConfig);

const LEADER_ONLY_PREFIXES = ["/dashboard", "/settings"];

export default auth((req) => {
  const { nextUrl } = req;
  const token = req.auth;
  const isLoggedIn = Boolean(token?.user);
  const isLoginPage = nextUrl.pathname === "/login";

  if (!isLoggedIn) {
    if (isLoginPage) return NextResponse.next();
    // Preserve the intended destination so login can bounce back to it.
    const loginUrl = new URL("/login", nextUrl);
    if (nextUrl.pathname !== "/") {
      loginUrl.searchParams.set(
        "callbackUrl",
        nextUrl.pathname + nextUrl.search,
      );
    }
    return NextResponse.redirect(loginUrl);
  }

  const role = token?.user?.role;
  const home = role === "LEADER" ? "/dashboard" : "/board";

  if (isLoginPage) {
    return NextResponse.redirect(new URL(home, nextUrl));
  }

  // Members never reach leader-only areas, even by typing the URL.
  const isLeaderOnly = LEADER_ONLY_PREFIXES.some(
    (prefix) =>
      nextUrl.pathname === prefix || nextUrl.pathname.startsWith(`${prefix}/`),
  );
  if (isLeaderOnly && role !== "LEADER") {
    return NextResponse.redirect(new URL("/board", nextUrl));
  }

  return NextResponse.next();
});

export const config = {
  // Run on every route except static assets, image optimization, and the
  // Auth.js endpoints themselves.
  matcher: [
    "/((?!api/auth|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
