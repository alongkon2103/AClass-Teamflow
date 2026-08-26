import { describe, expect, it } from "vitest";
import {
  calendarDate,
  parseCalendarDate,
  formatCalendarDate,
  addCalendarDays,
  todayInBangkok,
} from "@/lib/date";

describe("calendar date normalization", () => {
  it("anchors calendar days to UTC midnight so @db.Date never drifts", () => {
    const d = calendarDate(2026, 8, 26);
    expect(d.toISOString()).toBe("2026-08-26T00:00:00.000Z");
  });

  it("round-trips YYYY-MM-DD without shifting the day", () => {
    for (const iso of ["2026-01-01", "2026-08-26", "2026-12-31"]) {
      expect(formatCalendarDate(parseCalendarDate(iso))).toBe(iso);
    }
  });

  it("keeps the Bangkok day for a late-evening local timestamp", () => {
    // 23:30 on Aug 26 in Bangkok is still Aug 26 (16:30 UTC), not Aug 27.
    const lateEvening = new Date("2026-08-26T16:30:00.000Z");
    expect(formatCalendarDate(lateEvening)).toBe("2026-08-26");
  });

  it("rolls to the next Bangkok day once UTC passes 17:00", () => {
    // 17:00 UTC is 00:00 the next day in Bangkok (UTC+7).
    const justAfterMidnightBkk = new Date("2026-08-26T17:00:00.000Z");
    expect(formatCalendarDate(justAfterMidnightBkk)).toBe("2026-08-27");
  });

  it("adds and subtracts whole days across month boundaries", () => {
    const endOfMonth = parseCalendarDate("2026-08-31");
    expect(formatCalendarDate(addCalendarDays(endOfMonth, 1))).toBe(
      "2026-09-01",
    );
    expect(formatCalendarDate(addCalendarDays(endOfMonth, -31))).toBe(
      "2026-07-31",
    );
  });

  it("crosses a leap day correctly", () => {
    const feb28 = parseCalendarDate("2028-02-28");
    expect(formatCalendarDate(addCalendarDays(feb28, 1))).toBe("2028-02-29");
    expect(formatCalendarDate(addCalendarDays(feb28, 2))).toBe("2028-03-01");
  });

  it("returns a UTC-midnight anchored value for today", () => {
    const today = todayInBangkok();
    expect(today.getUTCHours()).toBe(0);
    expect(today.getUTCMinutes()).toBe(0);
    expect(formatCalendarDate(today)).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
