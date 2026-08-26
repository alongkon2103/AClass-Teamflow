import { redirect } from "next/navigation";
import { Columns3 } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { taskVisibilityFilter } from "@/lib/permissions";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { StatusBadge, PriorityBadge } from "@/components/shared/badges";
import { Avatar } from "@/components/shared/avatar";
import { TASK_STATUS_META, TASK_STATUS_ORDER } from "@/lib/constants";

export default async function BoardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  // Visibility is filtered in the query itself, never in the component.
  const tasks = await db.task.findMany({
    where: { archivedAt: null, ...taskVisibilityFilter(user) },
    select: {
      id: true,
      title: true,
      description: true,
      status: true,
      priority: true,
      dueDate: true,
      assignee: { select: { name: true, avatarColor: true } },
      _count: { select: { progress: true } },
    },
    orderBy: [{ status: "asc" }, { sortOrder: "asc" }],
  });

  return (
    <>
      <PageHeader
        title="บอร์ดคัมบัง"
        description="ลากการ์ดเพื่อเปลี่ยนสถานะงานที่รับผิดชอบ"
      />

      <div className="flex gap-4 overflow-x-auto pb-2">
        {TASK_STATUS_ORDER.map((status) => {
          const meta = TASK_STATUS_META[status];
          const columnTasks = tasks.filter((task) => task.status === status);
          return (
            <section
              key={status}
              className="min-w-[240px] flex-1"
              aria-label={meta.label}
            >
              <div className="flex items-center gap-2 px-1 pb-3">
                <span
                  aria-hidden="true"
                  className="size-2 rounded-full"
                  style={{ background: meta.mark }}
                />
                <span className="text-sm font-bold">{meta.label}</span>
                <span className="text-muted-foreground text-xs font-semibold">
                  {columnTasks.length} งาน
                </span>
              </div>

              <div
                className="min-h-30 rounded-2xl pt-3"
                style={{ borderTop: `3px solid ${meta.mark}` }}
              >
                {columnTasks.length === 0 ? (
                  <div className="border-line rounded-2xl border border-dashed">
                    <EmptyState
                      icon={Columns3}
                      message={`ยังไม่มีงานใน "${meta.label}"`}
                    />
                  </div>
                ) : (
                  columnTasks.map((task) => (
                    <article
                      key={task.id}
                      className="border-line bg-surface hover:shadow-lift mb-3 rounded-2xl border p-4 shadow-sm transition-[box-shadow,transform] duration-150 hover:-translate-y-0.5"
                    >
                      <PriorityBadge priority={task.priority} />
                      <h3 className="mt-2 text-sm leading-snug font-bold">
                        {task.title}
                      </h3>
                      {task.description ? (
                        <p className="text-muted-foreground mt-1 line-clamp-2 text-xs leading-relaxed">
                          {task.description}
                        </p>
                      ) : null}
                      <div className="mt-3 flex items-center justify-between gap-2">
                        <StatusBadge status={task.status} />
                        {task.assignee ? (
                          <Avatar user={task.assignee} size={24} />
                        ) : null}
                      </div>
                      {task._count.progress > 0 ? (
                        <p className="text-muted-foreground mt-2 text-[11px]">
                          {task._count.progress} อัพเดท
                        </p>
                      ) : null}
                    </article>
                  ))
                )}
              </div>
            </section>
          );
        })}
      </div>

      <p className="text-muted-foreground mt-6 text-sm">
        การลากวางและกล่องรายละเอียดงานจะถูกสร้างใน Phase 4
      </p>
    </>
  );
}
