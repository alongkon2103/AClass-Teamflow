import { describe, expect, it } from "vitest";
import { TaskStatus, Priority } from "@prisma/client";
import {
  completionRate,
  parseTaskFilters,
  TASKS_PER_PAGE,
} from "@/server/services/dashboard";

describe("parseTaskFilters", () => {
  it("defaults to an unfiltered first page", () => {
    expect(parseTaskFilters({})).toEqual({
      search: "",
      assigneeId: null,
      status: null,
      priority: null,
      page: 1,
    });
  });

  it("keeps valid enum values", () => {
    const filters = parseTaskFilters({
      status: TaskStatus.DOING,
      priority: Priority.URGENT,
    });
    expect(filters.status).toBe(TaskStatus.DOING);
    expect(filters.priority).toBe(Priority.URGENT);
  });

  it("drops values that are not real enum members", () => {
    // A hand-edited query string must not reach Prisma as a filter.
    const filters = parseTaskFilters({ status: "DROP TABLE", priority: "x" });
    expect(filters.status).toBeNull();
    expect(filters.priority).toBeNull();
  });

  it("trims the search term and treats blanks as absent", () => {
    expect(parseTaskFilters({ q: "  บั๊ก  " }).search).toBe("บั๊ก");
    expect(parseTaskFilters({ member: "   " }).assigneeId).toBeNull();
  });

  it("falls back to page 1 for junk or out-of-range pages", () => {
    expect(parseTaskFilters({ page: "0" }).page).toBe(1);
    expect(parseTaskFilters({ page: "-4" }).page).toBe(1);
    expect(parseTaskFilters({ page: "abc" }).page).toBe(1);
    expect(parseTaskFilters({ page: "3" }).page).toBe(3);
  });
});

describe("completionRate", () => {
  const zero = {
    [TaskStatus.TODO]: 0,
    [TaskStatus.DOING]: 0,
    [TaskStatus.REVIEW]: 0,
    [TaskStatus.DONE]: 0,
  };

  it("is 0 when there are no tasks, without dividing by zero", () => {
    expect(completionRate(zero, 0)).toBe(0);
  });

  it("rounds to a whole percentage", () => {
    expect(completionRate({ ...zero, [TaskStatus.DONE]: 1 }, 3)).toBe(33);
    expect(completionRate({ ...zero, [TaskStatus.DONE]: 2 }, 3)).toBe(67);
  });

  it("reaches 100 when everything is done", () => {
    expect(completionRate({ ...zero, [TaskStatus.DONE]: 5 }, 5)).toBe(100);
  });
});

describe("pagination", () => {
  it("uses the page size the spec asks for", () => {
    expect(TASKS_PER_PAGE).toBe(20);
  });
});
