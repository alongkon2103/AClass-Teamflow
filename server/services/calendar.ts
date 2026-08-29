import type { PrismaClient } from "@prisma/client";
import { type Actor, taskVisibilityFilter } from "@/lib/permissions";
import { parseCalendarDate, formatCalendarDate } from "@/lib/date";
import { listLeavesInRange } from "./leave";
import { listMeetingsInRange } from "./meeting";

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
  meetingsByDay: Record<
    string,
    { id: string; title: string; startTime: string | null }[]
  >;
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

  const [leaves, progress, due, meetings] = await Promise.all([
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
    listMeetingsInRange(db, from, to),
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

  const meetingsByDay: CalendarMonth["meetingsByDay"] = {};
  for (const meeting of meetings) {
    const day = formatCalendarDate(meeting.meetingAt);
    (meetingsByDay[day] ??= []).push({
      id: meeting.id,
      title: meeting.title,
      startTime: meeting.startTime,
    });
  }

  return { leavesByDay, progressByDay, dueByDay, meetingsByDay };
}

/** Everything shown in the day detail sheet. */
export async function loadDayDetail(
  db: PrismaClient,
  actor: Actor,
  dayISO: string,
) {
  const day = parseCalendarDate(dayISO);

  const [leaves, progress, dueTasks, meetings] = await Promise.all([
    listLeavesInRange(db, dayISO, dayISO),
    db.progressEntry.findMany({
      where: {
        entryDate: day,
        ...(actor.role === "LEADER" ? {} : { authorId: actor.id }),
      },
      select: {
        id: true,
        body: true,
        imageUrls: true,
        author: { select: { name: true, avatarColor: true, avatarUrl: true } },
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
        dueDate: true,
        completedAt: true,
        assignees: {
          select: {
            user: {
              select: { name: true, avatarColor: true, avatarUrl: true },
            },
          },
          orderBy: { assignedAt: "asc" },
        },
      },
    }),
    listMeetingsInRange(db, dayISO, dayISO),
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
      imageUrls: entry.imageUrls,
      author: entry.author,
      taskTitle: entry.task.title,
    })),
    dueTasks: dueTasks.map((task) => ({
      id: task.id,
      title: task.title,
      status: task.status,
      dueDate: task.dueDate ? formatCalendarDate(task.dueDate) : null,
      completedAt: task.completedAt
        ? formatCalendarDate(task.completedAt)
        : null,
      assignees: task.assignees.map((row) => row.user),
    })),
    meetings: meetings.map((meeting) => ({
      id: meeting.id,
      title: meeting.title,
      startTime: meeting.startTime,
      description: meeting.description,
      summary: meeting.summary,
    })),
  };
}
