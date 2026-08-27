import type { PrismaClient } from "@prisma/client";
import { LeaveStatus, NotificationType, Role } from "@prisma/client";
import { type Actor, assertCan, ForbiddenError } from "@/lib/permissions";
import { parseCalendarDate } from "@/lib/date";
import { NotFoundError } from "./task";

/**
 * Two closed date ranges overlap when each starts on or before the other ends.
 * Dates are "YYYY-MM-DD", which compares correctly as text.
 */
export function rangesOverlap(
  a: { start: string; end: string },
  b: { start: string; end: string },
): boolean {
  return a.start <= b.end && b.start <= a.end;
}

/** Leave that blocks a new request: anything not rejected. */
const BLOCKING_STATUSES = [LeaveStatus.PENDING, LeaveStatus.APPROVED];

export type CreateLeaveInput = {
  userId: string;
  startDate: string;
  endDate: string;
  reason: string | null;
};

export async function createLeave(
  db: PrismaClient,
  actor: Actor,
  input: CreateLeaveInput,
) {
  assertCan(actor, { type: "leave:request", leave: { userId: input.userId } });

  if (input.endDate < input.startDate) {
    throw new ForbiddenError("วันสิ้นสุดต้องไม่ก่อนวันเริ่มลา");
  }

  const start = parseCalendarDate(input.startDate);
  const end = parseCalendarDate(input.endDate);

  // Overlap is checked in the database so two requests cannot both pass.
  const clash = await db.leave.findFirst({
    where: {
      userId: input.userId,
      status: { in: BLOCKING_STATUSES },
      startDate: { lte: end },
      endDate: { gte: start },
    },
    select: { id: true },
  });
  if (clash) {
    throw new ForbiddenError("ช่วงวันที่นี้ทับซ้อนกับการลาที่มีอยู่แล้ว");
  }

  const leaders = await db.user.findMany({
    where: { role: Role.LEADER, isActive: true },
    select: { id: true },
  });
  const requester = await db.user.findUnique({
    where: { id: input.userId },
    select: { name: true },
  });

  return db.$transaction(async (tx) => {
    const leave = await tx.leave.create({
      data: {
        userId: input.userId,
        startDate: start,
        endDate: end,
        reason: input.reason,
      },
      select: { id: true, userId: true },
    });

    // Notify leaders, except one filing on their own behalf.
    const recipients = leaders.filter((leader) => leader.id !== actor.id);
    if (recipients.length > 0) {
      await tx.notification.createMany({
        data: recipients.map((leader) => ({
          recipientId: leader.id,
          actorId: actor.id,
          type: NotificationType.LEAVE_REQUESTED,
          payload: {
            leaveId: leave.id,
            userName: requester?.name ?? "สมาชิก",
          },
        })),
      });
    }

    return leave;
  });
}

export async function decideLeave(
  db: PrismaClient,
  actor: Actor,
  leaveId: string,
  status: typeof LeaveStatus.APPROVED | typeof LeaveStatus.REJECTED,
) {
  assertCan(actor, { type: "leave:decide" });

  const leave = await db.leave.findUnique({
    where: { id: leaveId },
    select: { id: true, userId: true, status: true },
  });
  if (!leave) throw new NotFoundError("ไม่พบคำขอลาที่ต้องการ");
  if (leave.status !== LeaveStatus.PENDING) {
    throw new ForbiddenError("คำขอลานี้ถูกตัดสินไปแล้ว");
  }

  return db.$transaction(async (tx) => {
    const updated = await tx.leave.update({
      where: { id: leaveId },
      data: { status, decidedById: actor.id, decidedAt: new Date() },
      select: { id: true, status: true, userId: true },
    });

    await tx.notification.create({
      data: {
        recipientId: updated.userId,
        actorId: actor.id,
        type: NotificationType.LEAVE_DECIDED,
        payload: { leaveId: updated.id, status: updated.status },
      },
    });

    return updated;
  });
}

export async function cancelLeave(
  db: PrismaClient,
  actor: Actor,
  leaveId: string,
) {
  const leave = await db.leave.findUnique({
    where: { id: leaveId },
    select: { id: true, userId: true, status: true },
  });
  if (!leave) throw new NotFoundError("ไม่พบคำขอลาที่ต้องการ");

  // Same rule as filing: leaders act on anyone, members only on themselves.
  assertCan(actor, { type: "leave:request", leave: { userId: leave.userId } });

  await db.leave.delete({ where: { id: leaveId } });
  return { id: leave.id };
}

/** Leaves overlapping a month, for the calendar grid. */
export async function listLeavesInRange(
  db: PrismaClient,
  fromISO: string,
  toISO: string,
) {
  return db.leave.findMany({
    where: {
      status: { in: BLOCKING_STATUSES },
      startDate: { lte: parseCalendarDate(toISO) },
      endDate: { gte: parseCalendarDate(fromISO) },
    },
    select: {
      id: true,
      startDate: true,
      endDate: true,
      reason: true,
      status: true,
      user: {
        select: { id: true, name: true, avatarColor: true, avatarUrl: true },
      },
    },
    orderBy: { startDate: "asc" },
  });
}

export async function listPendingLeaves(db: PrismaClient) {
  return db.leave.findMany({
    where: { status: LeaveStatus.PENDING },
    select: {
      id: true,
      startDate: true,
      endDate: true,
      reason: true,
      user: {
        select: { id: true, name: true, avatarColor: true, avatarUrl: true },
      },
    },
    orderBy: { startDate: "asc" },
  });
}
