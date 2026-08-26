"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Role } from "@prisma/client";
import { NAV_ITEMS } from "@/lib/constants";
import { cn } from "@/lib/utils";

/**
 * Pill tabs. Below 768px labels collapse to icons only (SPEC 6.4 #13); the
 * accessible name stays on the link so the nav is still usable by screen readers.
 */
export function NavTabs({ role }: { role: Role }) {
  const pathname = usePathname();
  const items = NAV_ITEMS.filter(
    (item) => !item.leaderOnly || role === "LEADER",
  );

  return (
    <nav
      aria-label="เมนูหลัก"
      className="bg-background flex items-center gap-1 rounded-xl p-1"
    >
      {items.map(({ href, label, icon: Icon }) => {
        const active = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            title={label}
            className={cn(
              "inline-flex items-center gap-2 rounded-[9px] px-3 py-2 text-[13px] font-semibold transition-colors duration-150",
              active
                ? "bg-surface text-primary-ink shadow-sm"
                : "text-muted-foreground hover:text-ink",
            )}
          >
            <Icon size={15} strokeWidth={2} />
            <span className="hidden sm:inline">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
