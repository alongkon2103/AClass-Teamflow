import { TaskStatus } from "@prisma/client";
import {
  addCalendarDays,
  formatCalendarDate,
  parseCalendarDate,
} from "@/lib/date";
import { daysBetween } from "@/lib/format";

/**
 * A finished task stays on the board this many days, then moves to the archive.
 *
 * The board is for work in flight; a column of things finished last month is
 * just noise. Nothing is deleted — the archive keeps every one of them.
 */
export const ARCHIVE_AFTER_DAYS = 3;

/** The first day a task finished on `completedAt` no longer belongs on the board. */
export function archiveFrom(completedAt: string): string {
  return formatCalendarDate(
    addCalendarDays(parseCalendarDate(completedAt), ARCHIVE_AFTER_DAYS),
  );
}

/**
 * The day a task counts as finished from.
 *
 * Tasks created before completion dates were recorded have none, and would
 * otherwise sit on the board for ever, so the day they were last touched
 * stands in. That stand-in is only ever used for tidying the board — the
 * delivery record still refuses to call a task late without a real date.
 */
function finishedOn(input: {
  completedAt: string | null;
  lastTouched?: string | null;
}): string | null {
  return input.completedAt ?? input.lastTouched ?? null;
}

/** Whether a task has been finished long enough to leave the board. */
export function shouldArchive(input: {
  status: TaskStatus;
  completedAt: string | null;
  lastTouched?: string | null;
  today: string;
}): boolean {
  if (input.status !== TaskStatus.DONE) return false;
  const finished = finishedOn(input);
  return finished !== null && input.today >= archiveFrom(finished);
}

/**
 * Days left before the task drops off the board, or null when it is not
 * counting down. Shown on the card so the disappearance is never a surprise.
 */
export function daysUntilArchive(input: {
  status: TaskStatus;
  completedAt: string | null;
  lastTouched?: string | null;
  today: string;
}): number | null {
  if (input.status !== TaskStatus.DONE) return null;
  const finished = finishedOn(input);
  if (!finished) return null;

  const left = daysBetween(input.today, archiveFrom(finished));
  return left > 0 ? left : null;
}
