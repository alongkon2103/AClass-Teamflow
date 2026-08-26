import Link from "next/link";
import { ClipboardList } from "lucide-react";
import type { TaskStatus, Priority } from "@prisma/client";
import { Avatar } from "@/components/shared/avatar";
import { EmptyState } from "@/components/shared/empty-state";
import { StatusBadge, PriorityBadge } from "@/components/shared/badges";
import { formatThaiDate, isOverdue } from "@/lib/format";
import { cn } from "@/lib/utils";

type Row = {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: Priority;
  startDate: string;
  dueDate: string | null;
  assignee: { id: string; name: string; avatarColor: string } | null;
};

export function TaskTable({
  rows,
  today,
  page,
  pageCount,
  totalCount,
  buildPageHref,
}: {
  rows: Row[];
  today: string;
  page: number;
  pageCount: number;
  totalCount: number;
  buildPageHref: (page: number) => string;
}) {
  if (rows.length === 0) {
    return (
      <EmptyState
        icon={ClipboardList}
        message="ไม่พบงานที่ตรงกับเงื่อนไขที่เลือก"
      />
    );
  }

  const headers = [
    "ชื่องาน",
    "ผู้รับผิดชอบ",
    "วันที่มอบหมาย",
    "เดดไลน์",
    "ความสำคัญ",
    "สถานะ",
  ];

  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] border-collapse">
          <thead>
            <tr className="text-muted-foreground text-left text-xs">
              {headers.map((header) => (
                <th
                  key={header}
                  scope="col"
                  className="border-line border-b px-3 py-2.5 font-semibold"
                >
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const overdue = isOverdue(row.dueDate, row.status, today);
              return (
                <tr
                  key={row.id}
                  className="border-line hover:bg-hover border-b"
                >
                  <td className="px-3 py-3">
                    <Link
                      href={`/board?task=${row.id}`}
                      className="text-[13px] font-semibold"
                    >
                      {row.title}
                    </Link>
                    {row.description ? (
                      <p className="text-muted-foreground mt-0.5 line-clamp-1 text-[11px]">
                        {row.description}
                      </p>
                    ) : null}
                  </td>
                  <td className="px-3 py-3">
                    {row.assignee ? (
                      <span className="inline-flex items-center gap-2">
                        <Avatar user={row.assignee} size={26} />
                        <span className="text-[13px]">{row.assignee.name}</span>
                      </span>
                    ) : (
                      <span className="text-muted-foreground text-[13px]">
                        ยังไม่กำหนด
                      </span>
                    )}
                  </td>
                  <td className="text-muted-foreground px-3 py-3 text-xs">
                    {formatThaiDate(row.startDate)}
                  </td>
                  <td className="px-3 py-3 text-xs">
                    <span
                      className={cn(
                        overdue ? "text-danger-ink font-bold" : "text-ink",
                      )}
                    >
                      {row.dueDate ? formatThaiDate(row.dueDate) : "—"}
                      {overdue ? " · เลยกำหนด" : ""}
                    </span>
                  </td>
                  <td className="px-3 py-3">
                    <PriorityBadge priority={row.priority} />
                  </td>
                  <td className="px-3 py-3">
                    <StatusBadge status={row.status} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <nav
        aria-label="แบ่งหน้า"
        className="mt-4 flex flex-wrap items-center justify-between gap-3"
      >
        <p className="text-muted-foreground text-xs">
          แสดงหน้า {page} จาก {pageCount} · ทั้งหมด {totalCount} งาน
        </p>
        <div className="flex gap-2">
          <PageLink href={buildPageHref(page - 1)} disabled={page <= 1}>
            ก่อนหน้า
          </PageLink>
          <PageLink href={buildPageHref(page + 1)} disabled={page >= pageCount}>
            ถัดไป
          </PageLink>
        </div>
      </nav>
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
  const className =
    "border-line inline-flex h-9 items-center rounded-xl border px-3 text-xs font-semibold";

  if (disabled) {
    return (
      <span
        aria-disabled="true"
        className={cn(className, "text-muted-foreground opacity-50")}
      >
        {children}
      </span>
    );
  }
  return (
    <Link href={href} className={cn(className, "hover:bg-hover")}>
      {children}
    </Link>
  );
}
