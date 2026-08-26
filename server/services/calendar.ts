import type { PrismaClient } from "@prisma/client";
import { TaskStatus } from "@prisma/client";
import { type Actor, taskVisibilityFilter } from "@/lib/permissions";
import { parseCalendarDate, formatCalendarDate } from "@/lib/date";
import { listLeavesInRange } from "./leave";

/** First and last day of a month, as calendar strings. */
export function monthBounds(year: number, month: number) {
  const first = new Date(Date.UTC(year, month - 1, 1));
  const last = new Date(Date.UTC(year, month, 0));
  return { from: formatCalendarDate(first), to: formatCalendarDate(last) };
}

/** Every day a leave covers, inclusive, as calendar strings. */
export function expandLeaveDays(startISO: string, endISO: string): string[] {
  const days: string[] = [];
  const start = parseCalendarDate(startISO);
  const end = parseCalendarDate(endISO);
  for (let d = start.getTime(); d <= end.getTime(); d += 86_400_000) {
    days.push(formatCalendarDate(new Date(d)));
  }
  return days;
}

export type CalendarMonth = {
  leavesByDay: Record<
    string,
    {
      id: string;
      name: string;
      avatarColor: string;
      status: string;
      reason: string | null;
    }[]
  >;
  progressByDay: Record<string, number>;
  dueByDay: Record<string, number>;
};

/**
 * Aggregates one month for the grid. A member only sees their own progress;
 * leave is visible to everyone (SPEC 5.5).
 */
export async function loadCalendarMonth(
  db: PrismaClient,
  actor: Actor,
  year: number,
  month: number,
): Promise<CalendarMonth> {
  const { from, to } = monthBounds(year, month);
  const fromDate = parseCalendarDate(from);
  const toDate = parseCalendarDate(to);

  const [leaves, progress, due] = await Promise.all([
    listLeavesInRange(db, from, to),
    db.progressEntry.findMany({
      where: {
        entryDate: { gte: fromDate, lte: toDate },
        ...(actor.role === "LEADER" ? {} : { authorId: actor.id }),
      },
      select: { entryDate: true },
    }),
    db.task.findMany({
      where: {
        archivedAt: null,
        dueDate: { gte: fromDate, lte: toDate },
        ...taskVisibilityFilter(actor),
      },
      select: { dueDate: true },
    }),
  ]);

  const leavesByDay: CalendarMonth["leavesByDay"] = {};
  for (const leave of leaves) {
    const days = expandLeaveDays(
      formatCalendarDate(leave.startDate),
      formatCalendarDate(leave.endDate),
    );
    for (const day of days) {
      if (day < from || day > to) continue;
      (leavesByDay[day] ??= []).push({
        id: leave.id,
        name: leave.user.name,
        avatarColor: leave.user.avatarColor,
        status: leave.status,
        reason: leave.reason,
      });
    }
  }

  const progressByDay: Record<string, number> = {};
  for (const entry of progress) {
    const day = formatCalendarDate(entry.entryDate);
    progressByDay[day] = (progressByDay[day] ?? 0) + 1;
  }

  const dueByDay: Record<string, number> = {};
  for (const task of due) {
    if (!task.dueDate) continue;
    const day = formatCalendarDate(task.dueDate);
    dueByDay[day] = (dueByDay[day] ?? 0) + 1;
  }

  return { leavesByDay, progressByDay, dueByDay };
}

/** Everything shown in the day detail sheet. */
export async function loadDayDetail(
  db: PrismaClient,
  actor: Actor,
  dayISO: string,
) {
  const day = parseCalendarDate(dayISO);

  const [leaves, progress, dueTasks] = await Promise.all([
    listLeavesInRange(db, dayISO, dayISO),
    db.progressEntry.findMany({
      where: {
        entryDate: day,
        ...(actor.role === "LEADER" ? {} : { authorId: actor.id }),
      },
      select: {
        id: true,
        body: true,
        imageUrl: true,
        author: { select: { name: true, avatarColor: true } },
        task: { select: { id: true, title: true } },
      },
      orderBy: { createdAt: "asc" },
    }),
    db.task.findMany({
      where: {
        archivedAt: null,
        dueDate: day,
        ...taskVisibilityFilter(actor),
      },
      select: {
        id: true,
        title: true,
        status: true,
        assignee: { select: { name: true, avatarColor: true } },
      },
    }),
  ]);

  return {
    leaves: leaves.map((leave) => ({
      id: leave.id,
      name: leave.user.name,
      avatarColor: leave.user.avatarColor,
      status: leave.status,
      reason: leave.reason,
      startDate: formatCalendarDate(leave.startDate),
      endDate: formatCalendarDate(leave.endDate),
    })),
    progress: progress.map((entry) => ({
      id: entry.id,
      body: entry.body,
      imageUrl: entry.imageUrl,
      author: entry.author,
      taskTitle: entry.task.title,
    })),
    dueTasks: dueTasks.map((task) => ({
      id: task.id,
      title: task.title,
      done: task.status === TaskStatus.DONE,
      assignee: task.assignee,
    })),
  };
}
