"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Archive, MessageSquare, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { TaskStatus, type Priority } from "@prisma/client";
import { Avatar } from "@/components/shared/avatar";
import { EmptyState } from "@/components/shared/empty-state";
import { PriorityBadge, StatusBadge } from "@/components/shared/badges";
import { Button } from "@/components/ui/button";
import { formatThaiDate } from "@/lib/format";
import { deliveryState, DELIVERY_META } from "@/lib/delivery";
import { restoreTaskAction } from "@/server/actions/archive";
import { cn } from "@/lib/utils";

export type ArchivedTask = {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: Priority;
  dueDate: string | null;
  completedAt: string | null;
  archivedAt: string;
  game: string | null;
  progressCount: number;
  assignees: {
    id: string;
    name: string;
    avatarColor: string;
    avatarUrl: string | null;
  }[];
};

export function ArchiveList({
  tasks,
  today,
  page,
  pageCount,
  totalCount,
  filterQuery,
}: {
  tasks: ArchivedTask[];
  today: string;
  page: number;
  pageCount: number;
  totalCount: number;
  /** The active filters as a query string; page links keep them. */
  filterQuery: string;
}) {
  const pageHref = (next: number) => {
    const query = new URLSearchParams(filterQuery);
    if (next > 1) query.set("page", String(next));
    else query.delete("page");
    const search = query.toString();
    return search ? `/archive?${search}` : "/archive";
  };

  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState<string | null>(null);

  const restore = (id: string, title: string) =>
    startTransition(async () => {
      const result = await restoreTaskAction({ id });
      if (result.ok) {
        toast.success(`นำ "${title}" กลับมาที่บอร์ดแล้ว`);
        setConfirming(null);
        router.refresh();
      } else {
        toast.error(result.message);
      }
    });

  if (tasks.length === 0) {
    return (
      <div className="border-line bg-surface rounded-[18px] border">
        <EmptyState
          icon={Archive}
          message="ยังไม่มีงานในคลัง — งานที่เสร็จแล้วจะย้ายมาที่นี่เองหลังผ่านไป 3 วัน"
        />
      </div>
    );
  }

  return (
    <>
      <ul className="flex flex-col gap-2">
        {tasks.map((task) => {
          // Delivery only means something for work that finished; anything
          // else in here was put away by hand and keeps its own status.
          const finished = task.status === TaskStatus.DONE;
          const meta = finished
            ? DELIVERY_META[
                deliveryState({
                  status: task.status,
                  dueDate: task.dueDate,
                  completedAt: task.completedAt,
                  today,
                })
              ]
            : null;

          return (
            <li
              key={task.id}
              className="border-line bg-surface rounded-[18px] border p-4 shadow-sm"
            >
              <div className="flex flex-wrap items-start gap-x-3 gap-y-2">
                <div className="min-w-0 flex-1">
                  <p className="text-[14.5px] font-bold">{task.title}</p>
                  {task.description ? (
                    <p className="text-muted-foreground mt-1 line-clamp-2 text-[13px] leading-relaxed">
                      {task.description}
                    </p>
                  ) : null}

                  <div className="text-muted-foreground mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11.5px] font-semibold">
                    <span>
                      {task.completedAt
                        ? `เสร็จเมื่อ ${formatThaiDate(task.completedAt)}`
                        : `เก็บเข้าคลัง ${formatThaiDate(task.archivedAt)}`}
                    </span>
                    {task.game ? <span>{task.game}</span> : null}
                    {task.progressCount > 0 ? (
                      <span className="inline-flex items-center gap-1">
                        <MessageSquare size={12} strokeWidth={2.5} />
                        {task.progressCount} อัปเดต
                      </span>
                    ) : null}
                  </div>
                </div>

                <div className="flex shrink-0 flex-wrap items-center gap-2">
                  {meta ? (
                    <span
                      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold whitespace-nowrap"
                      style={{
                        color: meta.ink,
                        background: `color-mix(in srgb, ${meta.mark} 16%, transparent)`,
                      }}
                    >
                      {meta.label}
                    </span>
                  ) : (
                    <StatusBadge status={task.status} />
                  )}
                  <PriorityBadge priority={task.priority} />

                  <span className="flex -space-x-1.5">
                    {task.assignees.map((person) => (
                      <Avatar key={person.id} user={person} size={24} />
                    ))}
                  </span>

                  {confirming === task.id ? (
                    <span className="flex items-center gap-1.5">
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => restore(task.id, task.title)}
                        disabled={pending}
                      >
                        ยืนยัน
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => setConfirming(null)}
                      >
                        ยกเลิก
                      </Button>
                    </span>
                  ) : (
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      onClick={() => setConfirming(task.id)}
                      disabled={pending}
                      title="นำกลับมาที่บอร์ดในสถานะกำลังทำ"
                    >
                      <RotateCcw size={14} strokeWidth={2} />
                      นำกลับมาทำต่อ
                    </Button>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-muted-foreground text-xs font-semibold">
          แสดงหน้า {page} จาก {pageCount} · ทั้งหมด {totalCount} งาน
        </p>
        <div className="flex gap-2">
          <PageLink href={pageHref(page - 1)} disabled={page <= 1}>
            ก่อนหน้า
          </PageLink>
          <PageLink href={pageHref(page + 1)} disabled={page >= pageCount}>
            ถัดไป
          </PageLink>
        </div>
      </div>
    </>
  );
}

function PageLink({
  href,
  disabled,
  children,
}: {
  href: string;
  disabled: boolean;
  children: React.ReactNode;
}) {
  const className = cn(
    "border-line inline-flex h-9 items-center rounded-xl border px-3 text-[13px] font-semibold",
    disabled
      ? "text-muted-foreground pointer-events-none opacity-50"
      : "hover:bg-hover",
  );

  if (disabled) {
    return (
      <span className={className} aria-disabled="true">
        {children}
      </span>
    );
  }
  return (
    <Link href={href} className={className}>
      {children}
    </Link>
  );
}
