import { redirect } from "next/navigation";
import { getCurrentUser, signOut } from "@/lib/auth";
import { db } from "@/lib/db";
import { Header } from "@/components/shell/header";
import { Toaster } from "@/components/ui/sonner";

/**
 * Session guard for every authenticated page. Middleware already redirects
 * anonymous traffic, but this second check keeps the guarantee even if a route
 * is reached in a way middleware does not cover.
 *
 * The session is a JWT, so deactivating or deleting someone does not end a
 * session they already hold — without this lookup they would keep browsing
 * until the token expired. One indexed primary-key read per page is a fair
 * price for revoking access immediately.
 */
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  // Profile fields are read here rather than from the JWT: a token issued at
  // sign-in still holds the old name, job title and photo, so a change would
  // not show until the next sign-in.
  const account = await db.user.findUnique({
    where: { id: user.id },
    select: {
      isActive: true,
      name: true,
      role: true,
      jobTitle: true,
      avatarColor: true,
      avatarUrl: true,
    },
  });
  if (!account?.isActive) {
    // Clears the cookie on the way out, so the next request starts clean.
    await signOut({ redirectTo: "/login" });
  }
  // signOut throws a redirect, so this only narrows the type for the compiler.
  if (!account) redirect("/login");

  return (
    <div className="flex min-h-dvh flex-col">
      <Header user={account} />
      <main className="mx-auto w-full max-w-[var(--container-app)] flex-1 px-6 py-6">
        {children}
      </main>
      <Toaster position="top-center" />
    </div>
  );
}
