import type { PrismaClient, Prisma } from "@prisma/client";
import { NotificationType, TaskStatus } from "@prisma/client";
import {
  type Actor,
  assertCan,
  canChangeAssignee,
  taskVisibilityFilter,
  ForbiddenError,
} from "@/lib/permissions";
import { parseCalendarDate, todayInBangkok } from "@/lib/date";
import type { TaskFormInput, MoveTaskInput } from "@/lib/validators/task";

/**
 * Task business logic. Takes a Prisma client so it can be unit tested against a
 * stub; knows nothing about requests, responses or React.
 */

/** Gap between sortOrder values, leaving room to insert without renumbering. */
export const SORT_STEP = 1000;

export class NotFoundError extends Error {
  constructor(message = "ไม่พบงานที่ต้องการ") {
    super(message);
    this.name = "NotFoundError";
  }
}

/**
 * sortOrder for a card dropped at `toIndex` among `siblings` (the destination
 * column, excluding the moved card, ordered by sortOrder).
 * Placing between two neighbours takes the midpoint; the ends step outward.
 */
export function sortOrderForIndex(
  siblings: { sortOrder: number }[],
  toIndex: number,
): number {
  if (siblings.length === 0) return SORT_STEP;

  const index = Math.max(0, Math.min(toIndex, siblings.length));
  if (index === 0) return siblings[0].sortOrder - SORT_STEP;
  if (index === siblings.length)
    return siblings[siblings.length - 1].sortOrder + SORT_STEP;

  const before = siblings[index - 1].sortOrder;
  const after = siblings[index].sortOrder;
  return (before + after) / 2;
}

/** Members may edit their own tasks but never change who they belong to. */
function assertAssigneeChangeAllowed(
  actor: Actor,
  current: string[],
  next: string[],
) {
  const unchanged =
    current.length === next.length &&
    [...current].sort().join() === [...next].sort().join();
  if (unchanged) return;
  if (!canChangeAssignee(actor)) {
    throw new ForbiddenError("คุณไม่มีสิทธิ์เปลี่ยนผู้รับผิดชอบงาน");
  }
}

/**
 * The day a task is considered delivered. Recorded when it reaches DONE and
 * cleared when it leaves, so reopening work does not leave a stale date behind.
 */
function completionFor(status: TaskStatus, previous: Date | null): Date | null {
  if (status !== TaskStatus.DONE) return null;
  // Keep the original day if it was already finished, so an unrelated edit
  // does not quietly move the delivery date forward.
  return previous ?? todayInBangkok();
}

/** Notifies each newly assigned person, skipping whoever made the change. */
async function notifyAssigned(
  tx: Prisma.TransactionClient,
  actor: Actor,
  task: { id: string; title: string },
  userIds: string[],
) {
  const recipients = userIds.filter((id) => id !== actor.id);
  if (recipients.length === 0) return;

  await tx.notification.createMany({
    data: recipients.map((recipientId) => ({
      recipientId,
      actorId: actor.id,
      type: NotificationType.TASK_ASSIGNED,
      payload: { taskId: task.id, taskTitle: task.title },
    })),
  });
}

export async function listBoardTasks(
  db: PrismaClient,
  actor: Actor,
  boardUserId: string | null,
) {
  // A leader may inspect one member's board; members are always scoped to self.
  const scope =
    actor.role === "LEADER" && boardUserId
      ? { assignees: { some: { userId: boardUserId } } }
      : taskVisibilityFilter(actor);

  return db.task.findMany({
    where: { archivedAt: null, ...scope },
    select: {
      id: true,
      title: true,
      description: true,
      status: true,
      priority: true,
      startDate: true,
      dueDate: true,
      completedAt: true,
      sortOrder: true,
      gameId: true,
      gameNote: true,
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
      game: { select: { id: true, name: true } },
      _count: { select: { progress: true } },
    },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });
}

export type BoardTask = Awaited<ReturnType<typeof listBoardTasks>>[number];

export async function createTask(
  db: PrismaClient,
  actor: Actor,
  input: TaskFormInput,
) {
  assertCan(actor, { type: "task:create", assigneeIds: input.assigneeIds });

  // Members cannot hand a new task to someone else.
  if (
    !canChangeAssignee(actor) &&
    input.assigneeIds.some((id) => id !== actor.id)
  ) {
    throw new ForbiddenError("คุณสร้างงานให้ตัวเองได้เท่านั้น");
  }

  const last = await db.task.findFirst({
    where: { archivedAt: null, status: input.status },
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true },
  });

  return db.$transaction(async (tx) => {
    const task = await tx.task.create({
      data: {
        title: input.title,
        description: input.description,
        status: input.status,
        priority: input.priority,
        startDate: parseCalendarDate(input.startDate),
        dueDate: input.dueDate ? parseCalendarDate(input.dueDate) : null,
        gameId: input.gameId,
        gameNote: input.gameNote,
        completedAt: completionFor(input.status, null),
        createdById: actor.id,
        sortOrder: (last?.sortOrder ?? 0) + SORT_STEP,
        assignees: {
          create: input.assigneeIds.map((userId) => ({ userId })),
        },
      },
      select: { id: true, title: true },
    });

    // Tell everyone put on the task, except whoever did the assigning.
    await notifyAssigned(tx, actor, task, input.assigneeIds);

    return task;
  });
}

export async function updateTask(
  db: PrismaClient,
  actor: Actor,
  taskId: string,
  input: TaskFormInput,
) {
  const existing = await db.task.findFirst({
    where: { id: taskId, archivedAt: null },
    select: {
      id: true,
      createdById: true,
      title: true,
      completedAt: true,
      assignees: { select: { userId: true } },
    },
  });
  if (!existing) throw new NotFoundError();

  const currentAssigneeIds = existing.assignees.map((row) => row.userId);
  assertCan(actor, {
    type: "task:update",
    task: {
      assigneeIds: currentAssigneeIds,
      createdById: existing.createdById,
    },
  });
  assertAssigneeChangeAllowed(actor, currentAssigneeIds, input.assigneeIds);

  // Only people who were not already on the task get told about it.
  const addedAssigneeIds = input.assigneeIds.filter(
    (id) => !currentAssigneeIds.includes(id),
  );

  return db.$transaction(async (tx) => {
    const task = await tx.task.update({
      where: { id: taskId },
      data: {
        title: input.title,
        description: input.description,
        status: input.status,
        priority: input.priority,
        startDate: parseCalendarDate(input.startDate),
        dueDate: input.dueDate ? parseCalendarDate(input.dueDate) : null,
        gameId: input.gameId,
        gameNote: input.gameNote,
        completedAt: completionFor(input.status, existing.completedAt),
        assignees: {
          deleteMany: { userId: { notIn: input.assigneeIds } },
          // Existing rows are left alone so their assignedAt (and card order)
          // survives an edit that only adds someone.
          createMany: {
            data: addedAssigneeIds.map((userId) => ({ userId })),
            skipDuplicates: true,
          },
        },
      },
      select: { id: true, title: true },
    });

    await notifyAssigned(tx, actor, task, addedAssigneeIds);

    return task;
  });
}

/**
 * Moves a card to a status column at a position. Crossing columns changes the
 * status; staying put only reorders (SPEC 5.3).
 */
export async function moveTask(
  db: PrismaClient,
  actor: Actor,
  input: MoveTaskInput,
) {
  const task = await db.task.findFirst({
    where: { id: input.taskId, archivedAt: null },
    select: {
      id: true,
      status: true,
      completedAt: true,
      assignees: { select: { userId: true } },
    },
  });
  if (!task) throw new NotFoundError();

  const assigneeIds = task.assignees.map((row) => row.userId);
  assertCan(actor, { type: "task:update", task: { assigneeIds } });

  // Order within the column as the board that issued the move displays it: the
  // board is always scoped to one person, so scope the siblings the same way.
  const boardUserId =
    actor.role === "LEADER" ? (input.boardUserId ?? null) : actor.id;

  const siblings = await db.task.findMany({
    where: {
      archivedAt: null,
      status: input.status,
      id: { not: task.id },
      ...(boardUserId ? { assignees: { some: { userId: boardUserId } } } : {}),
    },
    orderBy: { sortOrder: "asc" },
    select: { sortOrder: true },
  });

  return db.task.update({
    where: { id: task.id },
    data: {
      status: input.status,
      sortOrder: sortOrderForIndex(siblings, input.toIndex),
      completedAt: completionFor(input.status, task.completedAt),
    },
    select: { id: true, status: true, sortOrder: true },
  });
}

/** Soft delete — history and progress entries stay intact. */
export async function archiveTask(
  db: PrismaClient,
  actor: Actor,
  taskId: string,
) {
  const task = await db.task.findFirst({
    where: { id: taskId, archivedAt: null },
    select: {
      id: true,
      createdById: true,
      assignees: { select: { userId: true } },
    },
  });
  if (!task) throw new NotFoundError();

  assertCan(actor, {
    type: "task:delete",
    task: {
      assigneeIds: task.assignees.map((row) => row.userId),
      createdById: task.createdById,
    },
  });

  return db.task.update({
    where: { id: taskId },
    data: { archivedAt: new Date() },
    select: { id: true },
  });
}

/** Members and games needed to populate the task dialog's selects. */
export async function loadTaskFormOptions(db: PrismaClient, actor: Actor) {
  const [members, games] = await Promise.all([
    canChangeAssignee(actor)
      ? db.user.findMany({
          where: { isActive: true },
          select: {
            id: true,
            name: true,
            jobTitle: true,
            avatarColor: true,
            avatarUrl: true,
          },
          orderBy: { name: "asc" },
        })
      : Promise.resolve([]),
    db.game.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);
  return { members, games };
}

export type TaskWhere = Prisma.TaskWhereInput;
export type { TaskStatus };
