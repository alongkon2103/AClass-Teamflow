import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { Header } from "@/components/shell/header";
import { Toaster } from "@/components/ui/sonner";

/**
 * Session guard for every authenticated page. Middleware already redirects
 * anonymous traffic, but this second check keeps the guarantee even if a route
 * is reached in a way middleware does not cover.
 */
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <div className="flex min-h-dvh flex-col">
      <Header user={user} />
      <main className="mx-auto w-full max-w-[var(--container-app)] flex-1 px-6 py-6">
        {children}
      </main>
      <Toaster position="top-center" />
    </div>
  );
}
