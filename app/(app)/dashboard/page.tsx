import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import type { Role } from "@prisma/client";
import { Plus, TriangleAlert } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { can, defaultRouteFor } from "@/lib/permissions";
import { db } from "@/lib/db";
import { formatCalendarDate, todayInBangkok } from "@/lib/date";
import { toCalendarString } from "@/lib/format";
import {
  completionRate,
  loadStatusCounts,
  loadTaskPage,
  loadWorkload,
  parseTaskFilters,
} from "@/server/services/dashboard";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { StatusDonut } from "@/components/dashboard/status-donut";
import { WorkloadList } from "@/components/dashboard/workload-list";
import { TaskFilters } from "@/components/dashboard/task-filters";
import { TaskTable } from "@/components/dashboard/task-table";
import { buttonVariants } from "@/components/ui/button";
import {
  TASK_STATUS_META,
  TASK_STATUS_ORDER,
  TOTAL_TASKS_META,
} from "@/lib/constants";

type SearchParams = {
  q?: string;
  member?: string;
  status?: string;
  priority?: string;
  page?: string;
};

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  // Server-side authorization, not just a hidden nav link.
  if (!can({ id: user.id, role: user.role }, { type: "dashboard:view" })) {
    redirect(defaultRouteFor(user.role as Role));
  }

  const params = await searchParams;
  const filters = parseTaskFilters(params);

  const [{ counts, total }, workload, page] = await Promise.all([
    loadStatusCounts(db),
    loadWorkload(db),
    loadTaskPage(db, filters),
  ]);

  const today = formatCalendarDate(todayInBangkok());
  const members = workload.map((row) => ({ id: row.id, name: row.name }));

  const buildPageHref = (target: number) => {
    const query = new URLSearchParams();
    if (filters.search) query.set("q", filters.search);
    if (filters.assigneeId) query.set("member", filters.assigneeId);
    if (filters.status) query.set("status", filters.status);
    if (filters.priority) query.set("priority", filters.priority);
    if (target > 1) query.set("page", String(target));
    const qs = query.toString();
    return qs ? `/dashboard?${qs}` : "/dashboard";
  };

  return (
    <>
      <PageHeader
        title="ภาพรวม"
        description="สรุปสถานะงาน ภาระงานรายบุคคล และรายการงานทั้งหมดของทีม"
        action={
          <Link href="/board" className={buttonVariants()}>
            <Plus size={16} strokeWidth={2} />
            มอบหมายงานใหม่
          </Link>
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
              count={counts[status]}
              icon={meta.icon}
              mark={meta.mark}
            />
          );
        })}
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <section className="border-line bg-surface rounded-[18px] border p-6 shadow-sm">
          <h2 className="mb-4 text-[15.5px] font-bold">
            สัดส่วนสถานะงานทั้งหมด
          </h2>
          <StatusDonut
            counts={counts}
            total={total}
            completion={completionRate(counts, total)}
          />
        </section>

        <section className="border-line bg-surface rounded-[18px] border p-6 shadow-sm">
          <h2 className="mb-4 text-[15.5px] font-bold">ภาระงานรายบุคคล</h2>
          <WorkloadList rows={workload} />
        </section>
      </div>

      <section className="border-line bg-surface mt-6 rounded-[18px] border p-6 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-[15.5px] font-bold">
            งานทั้งหมดของทีม
            {page.overdueCount > 0 ? (
              <span className="text-danger-ink ml-2 inline-flex items-center gap-1 text-xs font-bold">
                <TriangleAlert size={13} strokeWidth={2} />
                เลยกำหนด {page.overdueCount} งาน
              </span>
            ) : null}
          </h2>
          {/* useSearchParams needs a boundary so the shell can stream first. */}
          <Suspense fallback={null}>
            <TaskFilters members={members} />
          </Suspense>
        </div>

        <TaskTable
          rows={page.rows.map((row) => ({
            ...row,
            startDate: formatCalendarDate(row.startDate),
            dueDate: toCalendarString(row.dueDate),
          }))}
          today={today}
          page={filters.page}
          pageCount={page.pageCount}
          totalCount={page.totalCount}
          buildPageHref={buildPageHref}
        />
      </section>
    </>
  );
}
