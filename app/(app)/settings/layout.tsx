import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { can, defaultRouteFor } from "@/lib/permissions";
import type { Role } from "@prisma/client";

/** Settings is leader-only; the check lives here so every child inherits it. */
export default async function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  if (!can({ id: user.id, role: user.role }, { type: "member:manage" })) {
    redirect(defaultRouteFor(user.role as Role));
  }

  return (
    <>
      <nav aria-label="ตั้งค่า" className="mb-6 flex gap-2">
        <Link
          href="/settings/members"
          className="border-line hover:bg-hover rounded-xl border px-3 py-2 text-[13px] font-semibold"
        >
          สมาชิก
        </Link>
        <Link
          href="/settings/games"
          className="border-line hover:bg-hover rounded-xl border px-3 py-2 text-[13px] font-semibold"
        >
          คลังเกม
        </Link>
      </nav>
      {children}
    </>
  );
}
