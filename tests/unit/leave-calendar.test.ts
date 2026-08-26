import { describe, expect, it } from "vitest";
import { rangesOverlap } from "@/server/services/leave";
import { monthBounds, expandLeaveDays } from "@/server/services/calendar";
import { createLeaveSchema, decideLeaveSchema } from "@/lib/validators/leave";
import { LeaveStatus } from "@prisma/client";

describe("rangesOverlap", () => {
  const r = (start: string, end: string) => ({ start, end });

  it("treats an identical single day as overlapping", () => {
    expect(
      rangesOverlap(
        r("2026-09-01", "2026-09-01"),
        r("2026-09-01", "2026-09-01"),
      ),
    ).toBe(true);
  });

  it("counts a shared boundary day as an overlap", () => {
    expect(
      rangesOverlap(
        r("2026-09-01", "2026-09-03"),
        r("2026-09-03", "2026-09-05"),
      ),
    ).toBe(true);
  });

  it("does not flag ranges that merely touch back to back", () => {
    expect(
      rangesOverlap(
        r("2026-09-01", "2026-09-02"),
        r("2026-09-03", "2026-09-04"),
      ),
    ).toBe(false);
  });

  it("detects containment in both directions", () => {
    expect(
      rangesOverlap(
        r("2026-09-01", "2026-09-10"),
        r("2026-09-04", "2026-09-05"),
      ),
    ).toBe(true);
    expect(
      rangesOverlap(
        r("2026-09-04", "2026-09-05"),
        r("2026-09-01", "2026-09-10"),
      ),
    ).toBe(true);
  });

  it("handles ranges that cross a month boundary", () => {
    expect(
      rangesOverlap(
        r("2026-08-30", "2026-09-02"),
        r("2026-09-01", "2026-09-01"),
      ),
    ).toBe(true);
  });
});

describe("monthBounds", () => {
  it("covers a 31-day month", () => {
    expect(monthBounds(2026, 8)).toEqual({
      from: "2026-08-01",
      to: "2026-08-31",
    });
  });

  it("covers a 30-day month", () => {
    expect(monthBounds(2026, 9)).toEqual({
      from: "2026-09-01",
      to: "2026-09-30",
    });
  });

  it("gets February right in a leap year and a common year", () => {
    expect(monthBounds(2028, 2).to).toBe("2028-02-29");
    expect(monthBounds(2026, 2).to).toBe("2026-02-28");
  });

  it("handles December without rolling the year", () => {
    expect(monthBounds(2026, 12)).toEqual({
      from: "2026-12-01",
      to: "2026-12-31",
    });
  });
});

describe("expandLeaveDays", () => {
  it("returns a single day for a one-day leave", () => {
    expect(expandLeaveDays("2026-08-26", "2026-08-26")).toEqual(["2026-08-26"]);
  });

  it("includes both endpoints", () => {
    expect(expandLeaveDays("2026-08-25", "2026-08-27")).toEqual([
      "2026-08-25",
      "2026-08-26",
      "2026-08-27",
    ]);
  });

  it("crosses a month boundary without drifting", () => {
    expect(expandLeaveDays("2026-08-30", "2026-09-01")).toEqual([
      "2026-08-30",
      "2026-08-31",
      "2026-09-01",
    ]);
  });
});

describe("leave schemas", () => {
  const base = { userId: "u1", startDate: "2026-09-01", endDate: "2026-09-02" };

  it("nulls a blank reason", () => {
    expect(createLeaveSchema.parse({ ...base, reason: "" }).reason).toBeNull();
  });

  it("rejects an end date before the start", () => {
    const result = createLeaveSchema.safeParse({
      ...base,
      endDate: "2026-08-31",
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(["endDate"]);
  });

  it("allows a single-day leave", () => {
    expect(
      createLeaveSchema.safeParse({ ...base, endDate: base.startDate }).success,
    ).toBe(true);
  });

  it("only accepts a final decision, never PENDING", () => {
    expect(
      decideLeaveSchema.safeParse({ id: "l1", status: LeaveStatus.APPROVED })
        .success,
    ).toBe(true);
    expect(
      decideLeaveSchema.safeParse({ id: "l1", status: LeaveStatus.REJECTED })
        .success,
    ).toBe(true);
    expect(
      decideLeaveSchema.safeParse({ id: "l1", status: LeaveStatus.PENDING })
        .success,
    ).toBe(false);
  });
});
