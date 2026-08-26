import type { PrismaClient, Prisma, TaskStatus } from "@prisma/client";
import { NotificationType } from "@prisma/client";
import {
  type Actor,
  assertCan,
  canChangeAssignee,
  taskVisibilityFilter,
  ForbiddenError,
} from "@/lib/permissions";
import { parseCalendarDate } from "@/lib/date";
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

/** Fields a member is allowed to change on a task they own. */
function assertAssigneeChangeAllowed(
  actor: Actor,
  currentAssigneeId: string | null,
  nextAssigneeId: string | null,
) {
  if (currentAssigneeId === nextAssigneeId) return;
  if (!canChangeAssignee(actor)) {
    throw new ForbiddenError("คุณไม่มีสิทธิ์เปลี่ยนผู้รับผิดชอบงาน");
  }
}

export async function listBoardTasks(
  db: PrismaClient,
  actor: Actor,
  boardUserId: string | null,
) {
  // A leader may inspect one member's board; members are always scoped to self.
  const scope =
    actor.role === "LEADER" && boardUserId
      ? { assigneeId: boardUserId }
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
      sortOrder: true,
      gameId: true,
      assigneeId: true,
      assignee: { select: { id: true, name: true, avatarColor: true } },
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
  assertCan(actor, { type: "task:create", assigneeId: input.assigneeId });

  // Members cannot hand a new task to someone else.
  if (!canChangeAssignee(actor) && input.assigneeId !== actor.id) {
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
        assigneeId: input.assigneeId,
        gameId: input.gameId,
        createdById: actor.id,
        sortOrder: (last?.sortOrder ?? 0) + SORT_STEP,
      },
      select: { id: true, title: true, assigneeId: true },
    });

    // Tell the assignee, unless they assigned it to themselves.
    if (task.assigneeId && task.assigneeId !== actor.id) {
      await tx.notification.create({
        data: {
          recipientId: task.assigneeId,
          actorId: actor.id,
          type: NotificationType.TASK_ASSIGNED,
          payload: { taskId: task.id, taskTitle: task.title },
        },
      });
    }

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
    select: { id: true, assigneeId: true, createdById: true, title: true },
  });
  if (!existing) throw new NotFoundError();

  assertCan(actor, { type: "task:update", task: existing });
  assertAssigneeChangeAllowed(actor, existing.assigneeId, input.assigneeId);

  const reassigned =
    existing.assigneeId !== input.assigneeId && input.assigneeId !== null;

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
        assigneeId: input.assigneeId,
        gameId: input.gameId,
      },
      select: { id: true, title: true, assigneeId: true },
    });

    if (reassigned && task.assigneeId && task.assigneeId !== actor.id) {
      await tx.notification.create({
        data: {
          recipientId: task.assigneeId,
          actorId: actor.id,
          type: NotificationType.TASK_ASSIGNED,
          payload: { taskId: task.id, taskTitle: task.title },
        },
      });
    }

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
    select: { id: true, assigneeId: true, status: true },
  });
  if (!task) throw new NotFoundError();

  assertCan(actor, { type: "task:update", task });

  // Order within the column the card belongs to, as the board displays it.
  const siblings = await db.task.findMany({
    where: {
      archivedAt: null,
      status: input.status,
      assigneeId: task.assigneeId,
      id: { not: task.id },
    },
    orderBy: { sortOrder: "asc" },
    select: { sortOrder: true },
  });

  return db.task.update({
    where: { id: task.id },
    data: {
      status: input.status,
      sortOrder: sortOrderForIndex(siblings, input.toIndex),
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
    select: { id: true, assigneeId: true, createdById: true },
  });
  if (!task) throw new NotFoundError();

  assertCan(actor, { type: "task:delete", task });

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
          select: { id: true, name: true, jobTitle: true, avatarColor: true },
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
