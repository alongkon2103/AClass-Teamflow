import { redirect } from "next/navigation";
import { Role } from "@prisma/client";
import { getCurrentUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { defaultRouteFor } from "@/lib/permissions";

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  // Server-side authorization, not just a hidden nav link.
  if (!can({ id: user.id, role: user.role }, { type: "dashboard:view" })) {
    redirect(defaultRouteFor(user.role as Role));
  }

  return (
    <section>
      <h1 className="text-[25px] font-extrabold tracking-tight">ภาพรวม</h1>
      <p className="text-muted-foreground mt-1 text-sm">
        สรุปสถานะงานและภาระงานของทีมทั้งหมด
      </p>
      <p className="text-muted-foreground mt-6 text-sm">
        เนื้อหาส่วนนี้จะถูกสร้างใน Phase 6
      </p>
    </section>
  );
}
