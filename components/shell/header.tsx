import Link from "next/link";
import { LogOut } from "lucide-react";
import type { Role } from "@prisma/client";
import { logoutAction } from "@/server/actions/auth";
import { Logo } from "@/components/shared/logo";
import { Avatar } from "@/components/shared/avatar";
import { NavTabs } from "@/components/shell/nav-tabs";
import { ThemeToggle } from "@/components/shell/theme-toggle";
import { NotificationBell } from "@/components/shell/notification-bell";
import { defaultRouteFor } from "@/lib/permissions";

type HeaderUser = {
  name: string;
  role: Role;
  jobTitle: string | null;
  avatarColor: string;
};

export function Header({ user }: { user: HeaderUser }) {
  const isLeader = user.role === "LEADER";

  return (
    <header className="bg-header border-line sticky top-0 z-50 h-16 border-b">
      <div className="mx-auto flex h-full max-w-[var(--container-app)] items-center gap-4 px-6">
        <Link
          href={defaultRouteFor(user.role)}
          className="flex shrink-0 items-center gap-3"
        >
          <Logo />
          <span className="hidden text-[17px] font-extrabold tracking-tight md:inline">
            TeamFlow
          </span>
        </Link>

        <div className="mx-auto">
          <NavTabs role={user.role} />
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <ThemeToggle />
          <NotificationBell />

          <div className="hidden text-right lg:block">
            <div className="text-muted-foreground text-[11px]">
              {isLeader ? "หัวหน้าทีม" : (user.jobTitle ?? "ทีมงาน")}
            </div>
            <div className="text-[13px] font-bold">{user.name}</div>
          </div>
          <Avatar user={user} size={36} />

          <form action={logoutAction}>
            <button
              type="submit"
              aria-label="ออกจากระบบ"
              title="ออกจากระบบ"
              className="border-line bg-hover text-ink hover:bg-primary-soft inline-flex size-10 items-center justify-center rounded-xl border transition-colors duration-150"
            >
              <LogOut size={16} strokeWidth={2} />
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
