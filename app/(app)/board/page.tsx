import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { TaskStatus } from "@prisma/client";
import { listBoardTasks, loadTaskFormOptions } from "@/server/services/task";
import { canChangeAssignee } from "@/lib/permissions";
import { toCalendarString } from "@/lib/format";
import { formatCalendarDate, todayInBangkok } from "@/lib/date";
import { PageHeader } from "@/components/shared/page-header";
import { Board } from "@/components/kanban/board";
import { UserSwitcher } from "@/components/kanban/user-switcher";
import { BoardSummary } from "@/components/kanban/board-summary";
import type { BoardTaskView, MemberOption } from "@/components/kanban/types";

export default async function BoardPage({
  searchParams,
}: {
  searchParams: Promise<{ user?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const actor = { id: user.id, role: user.role };
  const canAssign = canChangeAssignee(actor);
  const { user: requestedUserId } = await searchParams;

  // Only a leader may look at someone else's board; a member is always scoped
  // to themselves regardless of the query string.
  const boardUserId = canAssign ? (requestedUserId ?? null) : user.id;

  const [rows, options] = await Promise.all([
    listBoardTasks(db, actor, boardUserId),
    loadTaskFormOptions(db, actor),
  ]);

  const tasks: BoardTaskView[] = rows.map((task) => ({
    id: task.id,
    title: task.title,
    description: task.description,
    status: task.status,
    priority: task.priority,
    startDate: formatCalendarDate(task.startDate),
    dueDate: toCalendarString(task.dueDate),
    completedAt: toCalendarString(task.completedAt),
    updatedAt: formatCalendarDate(task.updatedAt),
    sortOrder: task.sortOrder,
    assigneeIds: task.assignees.map((row) => row.user.id),
    assignees: task.assignees.map((row) => row.user),
    gameId: task.gameId,
    gameNote: task.gameNote,
    progressCount: task._count.progress,
  }));

  const owner: MemberOption | null = boardUserId
    ? (options.members.find((member) => member.id === boardUserId) ?? {
        id: user.id,
        name: user.name,
        jobTitle: user.jobTitle,
        avatarColor: user.avatarColor,
        avatarUrl: user.avatarUrl,
      })
    : canAssign
      ? null
      : {
          id: user.id,
          name: user.name,
          jobTitle: user.jobTitle,
          avatarColor: user.avatarColor,
          avatarUrl: user.avatarUrl,
        };

  const today = formatCalendarDate(todayInBangkok());

  return (
    <>
      <PageHeader
        title="บอร์ดคัมบัง"
        description="ลากการ์ดเพื่อเปลี่ยนสถานะงาน หรือกดการ์ดเพื่อดูรายละเอียด"
        action={
          canAssign ? (
            <UserSwitcher members={options.members} value={boardUserId} />
          ) : undefined
        }
      />

      {owner ? (
        <BoardSummary
          owner={owner}
          total={tasks.length}
          doing={tasks.filter((t) => t.status === TaskStatus.DOING).length}
          done={tasks.filter((t) => t.status === TaskStatus.DONE).length}
        />
      ) : null}

      <Board
        initialTasks={tasks}
        members={options.members}
        games={options.games}
        canAssign={canAssign}
        today={today}
        defaultAssigneeId={boardUserId ?? (canAssign ? null : user.id)}
        boardUserId={boardUserId}
      />
    </>
  );
}
