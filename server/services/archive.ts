import type { PrismaClient, Prisma } from "@prisma/client";
import { TaskStatus } from "@prisma/client";
import { type Actor, assertCan, taskVisibilityFilter } from "@/lib/permissions";
import {
  addCalendarDays,
  formatCalendarDate,
  todayInBangkok,
} from "@/lib/date";
import { ARCHIVE_AFTER_DAYS } from "@/lib/archive";
import { NotFoundError, SORT_STEP } from "./task";

export const ARCHIVE_PAGE_SIZE = 20;

/**
 * Whether the sweep has already run today in this process.
 *
 * Eligibility only changes at midnight, because completion is stored as a
 * calendar day — so running once a day is exactly enough, and every later call
 * costs nothing. A restart just runs it again, which is harmless: the update is
 * idempotent.
 */
let sweptOn: string | null = null;

/**
 * Moves tasks finished more than ARCHIVE_AFTER_DAYS ago off the board.
 *
 * Called when a session with the app begins rather than from a cron job, so the
 * behaviour needs no scheduler and cannot drift if one stops running.
 */
export async function sweepFinishedTasks(db: PrismaClient): Promise<number> {
  const today = formatCalendarDate(todayInBangkok());
  if (sweptOn === today) return 0;

  const cutoff = addCalendarDays(todayInBangkok(), -ARCHIVE_AFTER_DAYS);
  // Everything up to the end of the cut-off day, for the rows that have no
  // completion date and fall back to when they were last touched.
  const touchedBefore = addCalendarDays(cutoff, 1);

  const { count } = await db.task.updateMany({
    where: {
      archivedAt: null,
      status: TaskStatus.DONE,
      OR: [
        { completedAt: { lte: cutoff } },
        { completedAt: null, updatedAt: { lt: touchedBefore } },
      ],
    },
    data: { archivedAt: new Date() },
  });

  sweptOn = today;
  return count;
}

/** Lets a test or a script force the next call to sweep again. */
export function resetSweep(): void {
  sweptOn = null;
}

export type ArchiveFilters = {
  search: string;
  assigneeId: string | null;
  gameId: string | null;
  page: number;
};

export function parseArchiveFilters(params: {
  q?: string;
  member?: string;
  game?: string;
  page?: string;
}): ArchiveFilters {
  const page = Number.parseInt(params.page ?? "1", 10);
  return {
    search: (params.q ?? "").trim(),
    assigneeId: params.member?.trim() ? params.member.trim() : null,
    gameId: params.game?.trim() ? params.game.trim() : null,
    page: Number.isFinite(page) && page > 0 ? page : 1,
  };
}

function whereFrom(
  actor: Actor,
  filters: ArchiveFilters,
): Prisma.TaskWhereInput {
  return {
    archivedAt: { not: null },
    ...taskVisibilityFilter(actor),
    ...(filters.assigneeId
      ? { assignees: { some: { userId: filters.assigneeId } } }
      : {}),
    ...(filters.gameId ? { gameId: filters.gameId } : {}),
    ...(filters.search
      ? {
          OR: [
            { title: { contains: filters.search, mode: "insensitive" } },
            { description: { contains: filters.search, mode: "insensitive" } },
          ],
        }
      : {}),
  };
}

/** One page of the archive, newest first, scoped to what the actor may see. */
export async function listArchivedTasks(
  db: PrismaClient,
  actor: Actor,
  filters: ArchiveFilters,
) {
  await sweepFinishedTasks(db);
  const where = whereFrom(actor, filters);

  const [rows, totalCount] = await Promise.all([
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
        completedAt: true,
        archivedAt: true,
        gameNote: true,
        game: { select: { id: true, name: true } },
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
        _count: { select: { progress: true } },
      },
      // Ordered by when the work finished, which is what a reader is looking
      // for. Rows with no completion date sort last rather than first, which is
      // where a descending sort would otherwise put a NULL.
      orderBy: [
        { completedAt: { sort: "desc", nulls: "last" } },
        { archivedAt: "desc" },
      ],
      skip: (filters.page - 1) * ARCHIVE_PAGE_SIZE,
      take: ARCHIVE_PAGE_SIZE,
    }),
    db.task.count({ where }),
  ]);

  return {
    rows,
    totalCount,
    pageCount: Math.max(1, Math.ceil(totalCount / ARCHIVE_PAGE_SIZE)),
  };
}

/**
 * Takes a task back out of the archive.
 *
 * A finished task is reopened rather than merely un-archived: left as DONE with
 * its old completion date, the next sweep would file it away again within
 * seconds. The completion date is cleared so the delivery record is not
 * claiming it finished on a day it is still being worked on.
 */
export async function restoreTask(
  db: PrismaClient,
  actor: Actor,
  taskId: string,
) {
  const task = await db.task.findFirst({
    where: { id: taskId, archivedAt: { not: null } },
    select: {
      id: true,
      title: true,
      status: true,
      createdById: true,
      assignees: { select: { userId: true } },
    },
  });
  if (!task) throw new NotFoundError();

  assertCan(actor, {
    type: "task:update",
    task: {
      assigneeIds: task.assignees.map((row) => row.userId),
      createdById: task.createdById,
    },
  });

  const reopen = task.status === TaskStatus.DONE;
  const status = reopen ? TaskStatus.DOING : task.status;

  const last = await db.task.findFirst({
    where: { archivedAt: null, status },
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true },
  });

  return db.task.update({
    where: { id: taskId },
    data: {
      archivedAt: null,
      status,
      completedAt: reopen ? null : undefined,
      // Back at the bottom of its column, where a returning card belongs.
      sortOrder: (last?.sortOrder ?? 0) + SORT_STEP,
    },
    select: { id: true, title: true, status: true },
  });
}
