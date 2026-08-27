import type { PrismaClient } from "@prisma/client";
import { NotificationType, Role } from "@prisma/client";
import { type Actor, assertCan } from "@/lib/permissions";
import { parseCalendarDate } from "@/lib/date";
import { NotFoundError } from "./task";
import type { CreateProgressInput } from "@/lib/validators/progress";

/** Short preview of a progress note, for notification payloads. */
export function excerpt(body: string, limit = 120): string {
  const text = body.replace(/\s+/g, " ").trim();
  return text.length <= limit ? text : `${text.slice(0, limit - 1)}…`;
}

export async function listProgressForTask(db: PrismaClient, taskId: string) {
  return db.progressEntry.findMany({
    where: { taskId },
    select: {
      id: true,
      entryDate: true,
      body: true,
      imageUrl: true,
      createdAt: true,
      authorId: true,
      author: { select: { id: true, name: true, avatarColor: true } },
      comments: {
        select: {
          id: true,
          body: true,
          createdAt: true,
          authorId: true,
          author: { select: { id: true, name: true, avatarColor: true } },
        },
        orderBy: { createdAt: "asc" },
      },
    },
    orderBy: [{ entryDate: "desc" }, { createdAt: "desc" }],
  });
}

/**
 * Reply to a member's daily update. Leader-only, matching who may act on a task
 * they do not own; the author is notified so the answer is not missed.
 */
export async function replyToProgress(
  db: PrismaClient,
  actor: Actor,
  entryId: string,
  body: string,
) {
  const entry = await db.progressEntry.findUnique({
    where: { id: entryId },
    select: {
      id: true,
      authorId: true,
      body: true,
      task: { select: { id: true, title: true } },
    },
  });
  if (!entry) throw new NotFoundError("ไม่พบความคืบหน้าที่ต้องการ");

  assertCan(actor, { type: "progress:reply" });

  return db.$transaction(async (tx) => {
    const comment = await tx.progressComment.create({
      data: { entryId: entry.id, authorId: actor.id, body },
      select: { id: true },
    });

    if (entry.authorId !== actor.id) {
      await tx.notification.create({
        data: {
          recipientId: entry.authorId,
          actorId: actor.id,
          type: NotificationType.PROGRESS_REPLIED,
          payload: {
            taskId: entry.task.id,
            taskTitle: entry.task.title,
            excerpt: excerpt(body),
          },
        },
      });
    }

    return comment;
  });
}

export async function deleteProgressComment(
  db: PrismaClient,
  actor: Actor,
  commentId: string,
) {
  const comment = await db.progressComment.findUnique({
    where: { id: commentId },
    select: { id: true, authorId: true },
  });
  if (!comment) throw new NotFoundError("ไม่พบข้อความตอบกลับ");

  // Same rule as progress entries: leaders anything, authors their own.
  assertCan(actor, {
    type: "progress:delete",
    entry: { authorId: comment.authorId },
  });

  await db.progressComment.delete({ where: { id: commentId } });
  return { id: comment.id };
}

/**
 * Records a progress entry. When a member submits one, every leader is notified
 * inside the same transaction so a notification can never be lost while the
 * entry is saved (SPEC 5.4).
 */
export async function createProgress(
  db: PrismaClient,
  actor: Actor,
  input: CreateProgressInput,
) {
  const task = await db.task.findFirst({
    where: { id: input.taskId, archivedAt: null },
    select: {
      id: true,
      title: true,
      assignees: { select: { userId: true } },
    },
  });
  if (!task) throw new NotFoundError();

  assertCan(actor, {
    type: "progress:create",
    task: { assigneeIds: task.assignees.map((row) => row.userId) },
  });

  const leaders =
    actor.role === Role.MEMBER
      ? await db.user.findMany({
          where: { role: Role.LEADER, isActive: true },
          select: { id: true },
        })
      : [];

  return db.$transaction(async (tx) => {
    const entry = await tx.progressEntry.create({
      data: {
        taskId: task.id,
        authorId: actor.id,
        entryDate: parseCalendarDate(input.entryDate),
        body: input.body,
        imageUrl: input.imageUrl,
      },
      select: { id: true, entryDate: true },
    });

    if (leaders.length > 0) {
      await tx.notification.createMany({
        data: leaders.map((leader) => ({
          recipientId: leader.id,
          actorId: actor.id,
          type: NotificationType.PROGRESS_SUBMITTED,
          payload: {
            taskId: task.id,
            taskTitle: task.title,
            excerpt: excerpt(input.body),
          },
        })),
      });
    }

    return entry;
  });
}

export async function deleteProgress(
  db: PrismaClient,
  actor: Actor,
  entryId: string,
) {
  const entry = await db.progressEntry.findUnique({
    where: { id: entryId },
    select: { id: true, authorId: true, taskId: true },
  });
  if (!entry) throw new NotFoundError("ไม่พบความคืบหน้าที่ต้องการ");

  assertCan(actor, { type: "progress:delete", entry });

  await db.progressEntry.delete({ where: { id: entryId } });
  return { id: entry.id, taskId: entry.taskId };
}
