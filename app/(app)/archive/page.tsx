import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { can } from "@/lib/permissions";
import { formatCalendarDate, todayInBangkok } from "@/lib/date";
import { toCalendarString } from "@/lib/format";
import { ARCHIVE_AFTER_DAYS } from "@/lib/archive";
import {
  listArchivedTasks,
  parseArchiveFilters,
} from "@/server/services/archive";
import { PageHeader } from "@/components/shared/page-header";
import { ArchiveFilters } from "@/components/archive/archive-filters";
import {
  ArchiveList,
  type ArchivedTask,
} from "@/components/archive/archive-list";

export default async function ArchivePage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    member?: string;
    game?: string;
    page?: string;
  }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const actor = { id: user.id, role: user.role };
  const params = await searchParams;
  const filters = parseArchiveFilters(params);
  const canFilterMembers = can(actor, { type: "task:viewAll" });

  const [page, members, games] = await Promise.all([
    listArchivedTasks(db, actor, filters),
    canFilterMembers
      ? db.user.findMany({
          where: { isActive: true },
          select: { id: true, name: true },
          orderBy: { name: "asc" },
        })
      : Promise.resolve([]),
    db.game.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const tasks: ArchivedTask[] = page.rows.map((task) => ({
    id: task.id,
    title: task.title,
    description: task.description,
    status: task.status,
    priority: task.priority,
    dueDate: toCalendarString(task.dueDate),
    completedAt: toCalendarString(task.completedAt),
    // Every row in this list is archived, so the column is never null here.
    archivedAt: formatCalendarDate(task.archivedAt as Date),
    game: task.game?.name ?? task.gameNote,
    progressCount: task._count.progress,
    assignees: task.assignees.map((row) => row.user),
  }));

  // Passed as a string, not a builder: a function cannot cross into a client
  // component.
  const filterQuery = new URLSearchParams();
  if (filters.search) filterQuery.set("q", filters.search);
  if (filters.assigneeId) filterQuery.set("member", filters.assigneeId);
  if (filters.gameId) filterQuery.set("game", filters.gameId);

  return (
    <>
      <PageHeader
        title="คลังงาน"
        description={`งานที่เสร็จแล้วเกิน ${ARCHIVE_AFTER_DAYS} วันจะย้ายมาที่นี่เอง พร้อมกับงานที่เก็บเข้าคลังด้วยมือ`}
      />

      <div className="mb-4">
        <Suspense fallback={null}>
          <ArchiveFilters
            members={members}
            games={games}
            canFilterMembers={canFilterMembers}
          />
        </Suspense>
      </div>

      <ArchiveList
        tasks={tasks}
        today={formatCalendarDate(todayInBangkok())}
        page={filters.page}
        pageCount={page.pageCount}
        totalCount={page.totalCount}
        filterQuery={filterQuery.toString()}
      />
    </>
  );
}
