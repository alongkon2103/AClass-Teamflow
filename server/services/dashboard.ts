import type { PrismaClient, Prisma } from "@prisma/client";
import { Priority, TaskStatus } from "@prisma/client";
import { todayInBangkok } from "@/lib/date";

/**
 * Dashboard aggregates. Every count is computed in the database rather than by
 * loading rows and counting in JS (SPEC section 7, N+1).
 */

export const TASKS_PER_PAGE = 20;

export type TaskFilters = {
  search: string;
  assigneeId: string | null;
  status: TaskStatus | null;
  priority: Priority | null;
  page: number;
};

export function parseTaskFilters(params: {
  q?: string;
  member?: string;
  status?: string;
  priority?: string;
  page?: string;
}): TaskFilters {
  const status =
    params.status && params.status in TaskStatus
      ? (params.status as TaskStatus)
      : null;
  const priority =
    params.priority && params.priority in Priority
      ? (params.priority as Priority)
      : null;
  const page = Number.parseInt(params.page ?? "1", 10);

  return {
    search: (params.q ?? "").trim(),
    assigneeId: params.member?.trim() ? params.member.trim() : null,
    status,
    priority,
    page: Number.isFinite(page) && page > 0 ? page : 1,
  };
}

function whereFromFilters(filters: TaskFilters): Prisma.TaskWhereInput {
  return {
    archivedAt: null,
    ...(filters.assigneeId
      ? { assignees: { some: { userId: filters.assigneeId } } }
      : {}),
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.priority ? { priority: filters.priority } : {}),
    ...(filters.search
      ? {
          OR: [
            {
              title: { contains: filters.search, mode: "insensitive" as const },
            },
            {
              description: {
                contains: filters.search,
                mode: "insensitive" as const,
              },
            },
          ],
        }
      : {}),
  };
}

export async function loadStatusCounts(db: PrismaClient) {
  const grouped = await db.task.groupBy({
    by: ["status"],
    where: { archivedAt: null },
    _count: { _all: true },
  });

  const counts = Object.fromEntries(
    Object.values(TaskStatus).map((status) => [status, 0]),
  ) as Record<TaskStatus, number>;

  for (const row of grouped) counts[row.status] = row._count._all;
  const total = Object.values(counts).reduce((sum, value) => sum + value, 0);

  return { counts, total };
}

/** Completion rate as a whole percentage; 0 when there are no tasks. */
export function completionRate(
  counts: Record<TaskStatus, number>,
  total: number,
) {
  if (total === 0) return 0;
  return Math.round((counts[TaskStatus.DONE] / total) * 100);
}

/**
 * Per-person workload. Everyone active is listed, leaders included — the board
 * previously filtered to MEMBER, so leaders who carry tasks showed nothing.
 * People with no tasks still appear, at 0, so the team roster stays complete.
 */
export async function loadWorkload(db: PrismaClient) {
  const [members, assignments] = await Promise.all([
    db.user.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        jobTitle: true,
        avatarColor: true,
        avatarUrl: true,
        role: true,
      },
      orderBy: [{ role: "asc" }, { name: "asc" }],
    }),
    // One row per (person, task) — a shared task counts for each assignee.
    db.taskAssignment.findMany({
      where: { task: { archivedAt: null } },
      select: { userId: true, task: { select: { status: true } } },
    }),
  ]);

  return members.map((member) => {
    const rows = assignments.filter((row) => row.userId === member.id);
    const total = rows.length;
    const done = rows.filter(
      (row) => row.task.status === TaskStatus.DONE,
    ).length;
    return {
      ...member,
      total,
      done,
      percent: total === 0 ? 0 : Math.round((done / total) * 100),
    };
  });
}

export async function loadTaskPage(db: PrismaClient, filters: TaskFilters) {
  const where = whereFromFilters(filters);

  const [rows, totalCount, overdueCount] = await Promise.all([
    db.task.findMany({
      where,
      select: {
        id: true,
        title: true,
        description: true,
        status: true,
        priority: true,
        startDate: true,
        dueDate: true,
        assignees: {
          select: {
            user: {
              select: {
                id: true,
                name: true,
                avatarColor: true,
                avatarUrl: true,
              },
            },
          },
          orderBy: { assignedAt: "asc" },
        },
      },
      orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
      skip: (filters.page - 1) * TASKS_PER_PAGE,
      take: TASKS_PER_PAGE,
    }),
    db.task.count({ where }),
    db.task.count({
      where: {
        archivedAt: null,
        status: { not: TaskStatus.DONE },
        dueDate: { lt: todayInBangkok() },
      },
    }),
  ]);

  return {
    rows,
    totalCount,
    overdueCount,
    pageCount: Math.max(1, Math.ceil(totalCount / TASKS_PER_PAGE)),
  };
}
