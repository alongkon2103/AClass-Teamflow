import { describe, expect, it } from "vitest";
import { TaskStatus } from "@prisma/client";
import {
  ARCHIVE_AFTER_DAYS,
  archiveFrom,
  daysUntilArchive,
  shouldArchive,
} from "@/lib/archive";
import { parseArchiveFilters } from "@/server/services/archive";

const TODAY = "2026-08-29";

describe("archiveFrom", () => {
  it("is the completion day plus the grace period", () => {
    expect(archiveFrom("2026-08-29")).toBe("2026-09-01");
    expect(ARCHIVE_AFTER_DAYS).toBe(3);
  });

  it("crosses a month boundary correctly", () => {
    expect(archiveFrom("2026-08-30")).toBe("2026-09-02");
  });

  it("handles a leap day", () => {
    expect(archiveFrom("2028-02-27")).toBe("2028-03-01");
  });
});

describe("shouldArchive", () => {
  const at = (over: Partial<Parameters<typeof shouldArchive>[0]>) =>
    shouldArchive({
      status: TaskStatus.DONE,
      completedAt: null,
      today: TODAY,
      ...over,
    });

  it("keeps a task finished today", () => {
    expect(at({ completedAt: TODAY })).toBe(false);
  });

  it("keeps it through the second day", () => {
    expect(at({ completedAt: "2026-08-27" })).toBe(false);
  });

  it("archives it once the third day has passed", () => {
    expect(at({ completedAt: "2026-08-26" })).toBe(true);
    expect(at({ completedAt: "2026-07-01" })).toBe(true);
  });

  it("leaves unfinished work alone however old", () => {
    for (const status of [
      TaskStatus.TODO,
      TaskStatus.DOING,
      TaskStatus.REVIEW,
    ]) {
      expect(at({ status, completedAt: "2026-01-01" })).toBe(false);
    }
  });

  it("falls back to the last edit when no completion date was recorded", () => {
    // Older tasks predate completion dates and would otherwise never leave.
    expect(at({ completedAt: null, lastTouched: "2026-08-26" })).toBe(true);
    expect(at({ completedAt: null, lastTouched: "2026-08-28" })).toBe(false);
  });

  it("prefers the real completion date over the fallback", () => {
    // Editing a task today must not keep a long-finished one on the board.
    expect(at({ completedAt: "2026-08-20", lastTouched: TODAY })).toBe(true);
  });

  it("leaves a finished task with neither date alone", () => {
    expect(at({ completedAt: null, lastTouched: null })).toBe(false);
    expect(at({ completedAt: null })).toBe(false);
  });
});

describe("daysUntilArchive", () => {
  const at = (over: Partial<Parameters<typeof daysUntilArchive>[0]>) =>
    daysUntilArchive({
      status: TaskStatus.DONE,
      completedAt: null,
      today: TODAY,
      ...over,
    });

  it("counts down the days still left on the board", () => {
    expect(at({ completedAt: TODAY })).toBe(3);
    expect(at({ completedAt: "2026-08-28" })).toBe(2);
    expect(at({ completedAt: "2026-08-27" })).toBe(1);
  });

  it("stops counting once the task is due to go", () => {
    expect(at({ completedAt: "2026-08-26" })).toBeNull();
    expect(at({ completedAt: "2026-08-01" })).toBeNull();
  });

  it("says nothing about work that is not finished", () => {
    expect(at({ status: TaskStatus.DOING, completedAt: TODAY })).toBeNull();
    expect(at({ completedAt: null })).toBeNull();
  });

  it("agrees with shouldArchive on every day around the boundary", () => {
    for (const completedAt of [
      "2026-08-24",
      "2026-08-25",
      "2026-08-26",
      "2026-08-27",
      "2026-08-28",
      "2026-08-29",
    ]) {
      const gone = shouldArchive({
        status: TaskStatus.DONE,
        completedAt,
        today: TODAY,
      });
      // A countdown means it is still on the board, and vice versa.
      expect(at({ completedAt }) === null).toBe(gone);
    }
  });
});

describe("parseArchiveFilters", () => {
  it("defaults to the first page with nothing filtered", () => {
    expect(parseArchiveFilters({})).toEqual({
      search: "",
      assigneeId: null,
      gameId: null,
      page: 1,
    });
  });

  it("trims the search and keeps the ids", () => {
    expect(
      parseArchiveFilters({ q: "  จ่ายเงิน  ", member: "u1" }),
    ).toMatchObject({ search: "จ่ายเงิน", assigneeId: "u1" });
  });

  it("falls back to page 1 for anything that is not a page", () => {
    for (const page of ["0", "-3", "abc", ""]) {
      expect(parseArchiveFilters({ page }).page).toBe(1);
    }
    expect(parseArchiveFilters({ page: "4" }).page).toBe(4);
  });

  it("treats a blank filter as no filter", () => {
    expect(parseArchiveFilters({ member: "  ", game: "" })).toMatchObject({
      assigneeId: null,
      gameId: null,
    });
  });
});
