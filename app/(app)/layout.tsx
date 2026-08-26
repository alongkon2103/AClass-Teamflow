import { redirect } from "next/navigation";
import { LogOut } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { logoutAction } from "@/server/actions/auth";
import { Button } from "@/components/ui/button";

/**
 * Session guard for every authenticated page. Middleware already redirects
 * anonymous traffic, but this second check keeps the guarantee even if a route
 * is reached in a way middleware does not cover.
 *
 * The full app shell (header, nav tabs, theme toggle) lands in Phase 3.
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
      <header className="bg-card sticky top-0 z-10 flex h-16 items-center justify-between border-b px-6">
        <span className="text-base font-bold tracking-tight">TeamFlow</span>
        <div className="flex items-center gap-3">
          <span className="text-muted-foreground text-sm">
            {user.name} · {user.role === "LEADER" ? "หัวหน้าทีม" : "ทีมงาน"}
          </span>
          <form action={logoutAction}>
            <Button type="submit" variant="ghost" size="sm">
              <LogOut size={16} strokeWidth={2} />
              ออกจากระบบ
            </Button>
          </form>
        </div>
      </header>
      <main className="mx-auto w-full max-w-[1240px] flex-1 p-6">
        {children}
      </main>
    </div>
  );
}
