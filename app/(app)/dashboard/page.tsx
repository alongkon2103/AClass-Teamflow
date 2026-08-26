import { redirect } from "next/navigation";
import type { Role } from "@prisma/client";
import { Plus } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { can, defaultRouteFor } from "@/lib/permissions";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { Button } from "@/components/ui/button";
import {
  TASK_STATUS_META,
  TASK_STATUS_ORDER,
  TOTAL_TASKS_META,
} from "@/lib/constants";

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  // Server-side authorization, not just a hidden nav link.
  if (!can({ id: user.id, role: user.role }, { type: "dashboard:view" })) {
    redirect(defaultRouteFor(user.role as Role));
  }

  const grouped = await db.task.groupBy({
    by: ["status"],
    where: { archivedAt: null },
    _count: { _all: true },
  });
  const countOf = (status: (typeof TASK_STATUS_ORDER)[number]) =>
    grouped.find((row) => row.status === status)?._count._all ?? 0;
  const total = grouped.reduce((sum, row) => sum + row._count._all, 0);

  return (
    <>
      <PageHeader
        title="ภาพรวม"
        description="สรุปสถานะงานและภาระงานของทีมทั้งหมด"
        action={
          <Button>
            <Plus size={16} strokeWidth={2} />
            มอบหมายงานใหม่
          </Button>
        }
      />

      <div className="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-4">
        <StatCard
          label={TOTAL_TASKS_META.label}
          caption={TOTAL_TASKS_META.caption}
          count={total}
          icon={TOTAL_TASKS_META.icon}
          mark={TOTAL_TASKS_META.mark}
        />
        {TASK_STATUS_ORDER.map((status) => {
          const meta = TASK_STATUS_META[status];
          return (
            <StatCard
              key={status}
              label={meta.label}
              caption={meta.caption}
              count={countOf(status)}
              icon={meta.icon}
              mark={meta.mark}
            />
          );
        })}
      </div>

      <p className="text-muted-foreground mt-6 text-sm">
        โดนัทชาร์ต ภาระงานรายบุคคล และตารางงานจะถูกสร้างใน Phase 6
      </p>
    </>
  );
}
