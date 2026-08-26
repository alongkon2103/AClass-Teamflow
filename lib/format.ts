import { TaskStatus } from "@prisma/client";
import { formatCalendarDate } from "@/lib/date";

/**
 * Display helpers for calendar-day strings ("YYYY-MM-DD"). Keeping the wire
 * format as a plain string avoids Date objects drifting across the server/client
 * boundary; all real timezone work happens in lib/date.ts.
 */

const THAI_MONTHS_SHORT = [
  "ม.ค.",
  "ก.พ.",
  "มี.ค.",
  "เม.ย.",
  "พ.ค.",
  "มิ.ย.",
  "ก.ค.",
  "ส.ค.",
  "ก.ย.",
  "ต.ค.",
  "พ.ย.",
  "ธ.ค.",
];

export const THAI_MONTHS_FULL = [
  "มกราคม",
  "กุมภาพันธ์",
  "มีนาคม",
  "เมษายน",
  "พฤษภาคม",
  "มิถุนายน",
  "กรกฎาคม",
  "สิงหาคม",
  "กันยายน",
  "ตุลาคม",
  "พฤศจิกายน",
  "ธันวาคม",
];

/** "2026-08-26" -> "26 ส.ค. 2569" (Buddhist era). */
export function formatThaiDate(iso: string): string {
  const [year, month, day] = iso.split("-").map(Number);
  return `${day} ${THAI_MONTHS_SHORT[month - 1]} ${year + 543}`;
}

/** Serialise a DB date column to the wire format, in Bangkok time. */
export function toCalendarString(date: Date | null): string | null {
  return date ? formatCalendarDate(date) : null;
}

/** Whole days from `from` to `to`; negative when `to` is in the past. */
export function daysBetween(from: string, to: string): number {
  const a = Date.parse(`${from}T00:00:00Z`);
  const b = Date.parse(`${to}T00:00:00Z`);
  return Math.round((b - a) / 86_400_000);
}

/** A task is overdue when it is unfinished and its due date has passed. */
export function isOverdue(
  dueDate: string | null,
  status: TaskStatus,
  today: string,
): boolean {
  if (!dueDate || status === TaskStatus.DONE) return false;
  return dueDate < today;
}
