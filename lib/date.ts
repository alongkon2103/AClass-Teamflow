import { formatInTimeZone } from "date-fns-tz";

/**
 * Calendar-day helpers. Columns typed `@db.Date` store only y-m-d, but a naive
 * `new Date(y, m, d)` is midnight *local* time and can serialize to the previous
 * day once converted to UTC. We anchor every calendar day to UTC midnight so
 * Prisma serializes exactly the intended y-m-d regardless of the server's TZ.
 */
export const TIME_ZONE = "Asia/Bangkok";

/** Build a drift-free calendar Date (UTC midnight) from y/m/d. month is 1-12. */
export function calendarDate(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month - 1, day));
}

/** Parse "YYYY-MM-DD" into a drift-free calendar Date (UTC midnight). */
export function parseCalendarDate(iso: string): Date {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

/** Format any Date as "YYYY-MM-DD" in Bangkok time. */
export function formatCalendarDate(date: Date): string {
  return formatInTimeZone(date, TIME_ZONE, "yyyy-MM-dd");
}

/** Today's calendar day in Bangkok, as a drift-free calendar Date. */
export function todayInBangkok(): Date {
  return parseCalendarDate(formatCalendarDate(new Date()));
}

/** Add (or subtract) whole days to a calendar Date, staying at UTC midnight. */
export function addCalendarDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}
