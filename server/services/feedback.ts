import type { PrismaClient, Prisma } from "@prisma/client";
import {
  FeedbackStatus,
  NotificationType,
  TaskStatus,
  Priority,
} from "@prisma/client";
import { type Actor, assertCan, ForbiddenError } from "@/lib/permissions";
import { parseCalendarDate, todayInBangkok } from "@/lib/date";
import { NotFoundError, SORT_STEP } from "./task";

/**
 * Advisory-lock key for ticket-number allocation. Any constant works as long as
 * every allocator agrees on it; this one is derived from "teamflow.ticket".
 */
const TICKET_LOCK_KEY = 728_314_905;

export function formatTicketNumber(sequence: number): string {
  return `TK-${String(sequence).padStart(4, "0")}`;
}

/** Highest ticket sequence currently stored, or 0 when there are none. */
export function highestSequence(numbers: string[]): number {
  return numbers.reduce((highest, value) => {
    const match = /^TK-(\d+)$/.exec(value);
    if (!match) return highest;
    return Math.max(highest, Number.parseInt(match[1], 10));
  }, 0);
}

/**
 * Allocates the next ticket number inside a transaction holding a Postgres
 * advisory lock, so two concurrent submissions can never receive the same
 * number (SPEC section 2 — a bare count()+1 is explicitly not enough).
 * The lock is released automatically when the transaction ends.
 */
export async function nextTicketNumber(
  tx: Prisma.TransactionClient,
): Promise<string> {
  // $executeRaw, not $queryRaw: the function returns void, which has no
  // Prisma column type to deserialize.
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(${TICKET_LOCK_KEY}::bigint)`;

  const rows = await tx.$queryRaw<{ ticketNumber: string }[]>`
    SELECT "ticketNumber" FROM "Feedback"
    WHERE "ticketNumber" ~ '^TK-[0-9]+$'
    ORDER BY CAST(SUBSTRING("ticketNumber" FROM 4) AS INTEGER) DESC
    LIMIT 1
  `;

  return formatTicketNumber(
    highestSequence(rows.map((r) => r.ticketNumber)) + 1,
  );
}

export type FeedbackFilters = {
  search: string;
  status: FeedbackStatus | null;
  gameId: string | null;
};

export function parseFeedbackFilters(params: {
  q?: string;
  status?: string;
  game?: string;
}): FeedbackFilters {
  return {
    search: (params.q ?? "").trim(),
    status:
      params.status && params.status in FeedbackStatus
        ? (params.status as FeedbackStatus)
        : null,
    gameId: params.game?.trim() ? params.game.trim() : null,
  };
}

export async function listFeedback(db: PrismaClient, filters: FeedbackFilters) {
  return db.feedback.findMany({
    where: {
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.gameId ? { gameId: filters.gameId } : {}),
      ...(filters.search
        ? {
            OR: [
              { body: { contains: filters.search, mode: "insensitive" } },
              {
                customerName: { contains: filters.search, mode: "insensitive" },
              },
              {
                ticketNumber: { contains: filters.search, mode: "insensitive" },
              },
            ],
          }
        : {}),
    },
    select: {
      id: true,
      ticketNumber: true,
      customerName: true,
      reportedAt: true,
      body: true,
      status: true,
      replyBody: true,
      repliedAt: true,
      linkedTaskId: true,
      game: { select: { id: true, name: true } },
      repliedBy: { select: { name: true, avatarColor: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

export type CreateFeedbackInput = {
  customerName: string;
  reportedAt: string;
  gameId: string;
  body: string;
  ticketNumber?: string | null;
};

export async function createFeedback(
  db: PrismaClient,
  actor: Actor,
  input: CreateFeedbackInput,
) {
  assertCan(actor, { type: "feedback:create" });

  return db.$transaction(
    async (tx) => {
      // A leader may override the generated number; otherwise allocate one.
      const ticketNumber =
        input.ticketNumber?.trim() || (await nextTicketNumber(tx));

      const clash = await tx.feedback.findUnique({
        where: { ticketNumber },
        select: { id: true },
      });
      if (clash) throw new ForbiddenError("หมายเลข Ticket นี้ถูกใช้แล้ว");

      return tx.feedback.create({
        data: {
          ticketNumber,
          customerName: input.customerName.trim(),
          reportedAt: parseCalendarDate(input.reportedAt),
          gameId: input.gameId,
          body: input.body.trim(),
        },
        select: { id: true, ticketNumber: true },
      });
    },
    // The advisory lock serialises allocations, so bursts queue rather than
    // collide — allow enough time to wait for a slot instead of failing.
    { maxWait: 15_000, timeout: 20_000 },
  );
}

export type ReplyFeedbackInput = {
  id: string;
  status: FeedbackStatus;
  replyBody: string | null;
  createTask: boolean;
  assigneeId: string | null;
};

/**
 * Leader reply. When the decision is FIXING and a task is requested, the task is
 * created and linked in the same transaction so the two can never diverge.
 */
export async function replyToFeedback(
  db: PrismaClient,
  actor: Actor,
  input: ReplyFeedbackInput,
) {
  assertCan(actor, { type: "feedback:reply" });

  const feedback = await db.feedback.findUnique({
    where: { id: input.id },
    select: {
      id: true,
      ticketNumber: true,
      body: true,
      gameId: true,
      linkedTaskId: true,
      customerName: true,
    },
  });
  if (!feedback) throw new NotFoundError("ไม่พบฟีดแบคที่ต้องการ");

  const wantsTask = input.createTask && input.status === FeedbackStatus.FIXING;

  return db.$transaction(async (tx) => {
    let linkedTaskId = feedback.linkedTaskId;

    if (wantsTask && !linkedTaskId) {
      const last = await tx.task.findFirst({
        where: { archivedAt: null, status: TaskStatus.TODO },
        orderBy: { sortOrder: "desc" },
        select: { sortOrder: true },
      });

      const task = await tx.task.create({
        data: {
          title: `แก้ไขจากฟีดแบค ${feedback.ticketNumber}`,
          description: feedback.body,
          status: TaskStatus.TODO,
          priority: Priority.IMPORTANT,
          startDate: todayInBangkok(),
          gameId: feedback.gameId,
          createdById: actor.id,
          sortOrder: (last?.sortOrder ?? 0) + SORT_STEP,
          ...(input.assigneeId
            ? { assignees: { create: [{ userId: input.assigneeId }] } }
            : {}),
        },
        select: { id: true, title: true },
      });
      linkedTaskId = task.id;

      if (input.assigneeId && input.assigneeId !== actor.id) {
        await tx.notification.create({
          data: {
            recipientId: input.assigneeId,
            actorId: actor.id,
            type: NotificationType.TASK_ASSIGNED,
            payload: { taskId: task.id, taskTitle: task.title },
          },
        });
      }
    }

    return tx.feedback.update({
      where: { id: feedback.id },
      data: {
        status: input.status,
        replyBody: input.replyBody?.trim() || null,
        repliedById: actor.id,
        repliedAt: new Date(),
        linkedTaskId,
      },
      select: { id: true, status: true, linkedTaskId: true },
    });
  });
}

export async function deleteFeedback(
  db: PrismaClient,
  actor: Actor,
  id: string,
) {
  assertCan(actor, { type: "feedback:reply" });
  const existing = await db.feedback.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!existing) throw new NotFoundError("ไม่พบฟีดแบคที่ต้องการ");
  await db.feedback.delete({ where: { id } });
  return { id };
}
