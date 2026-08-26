import { describe, expect, it } from "vitest";
import { sortOrderForIndex, SORT_STEP } from "@/server/services/task";
import { taskFormSchema, moveTaskSchema } from "@/lib/validators/task";
import { isOverdue, daysBetween, formatThaiDate } from "@/lib/format";
import { TaskStatus, Priority } from "@prisma/client";

describe("sortOrderForIndex", () => {
  const siblings = [
    { sortOrder: 1000 },
    { sortOrder: 2000 },
    { sortOrder: 3000 },
  ];

  it("uses a default step for an empty column", () => {
    expect(sortOrderForIndex([], 0)).toBe(SORT_STEP);
    // Index beyond the end of an empty column is still the first slot.
    expect(sortOrderForIndex([], 5)).toBe(SORT_STEP);
  });

  it("steps below the first card when dropped at the top", () => {
    expect(sortOrderForIndex(siblings, 0)).toBe(0);
  });

  it("steps above the last card when dropped at the bottom", () => {
    expect(sortOrderForIndex(siblings, 3)).toBe(4000);
  });

  it("takes the midpoint between neighbours", () => {
    expect(sortOrderForIndex(siblings, 1)).toBe(1500);
    expect(sortOrderForIndex(siblings, 2)).toBe(2500);
  });

  it("clamps an out-of-range index instead of producing NaN", () => {
    expect(sortOrderForIndex(siblings, 99)).toBe(4000);
    expect(sortOrderForIndex(siblings, -3)).toBe(0);
  });

  it("keeps ordering stable after repeated inserts at the same slot", () => {
    const list = [{ sortOrder: 1000 }, { sortOrder: 2000 }];
    const first = sortOrderForIndex(list, 1);
    const withFirst = [
      { sortOrder: 1000 },
      { sortOrder: first },
      { sortOrder: 2000 },
    ];
    const second = sortOrderForIndex(withFirst, 1);
    expect(second).toBeGreaterThan(1000);
    expect(second).toBeLessThan(first);
  });
});

describe("taskFormSchema", () => {
  const base = {
    title: "งานทดสอบ",
    status: TaskStatus.TODO,
    priority: Priority.NORMAL,
    startDate: "2026-08-26",
  };

  it("accepts a minimal valid task and nulls the blank optionals", () => {
    const parsed = taskFormSchema.parse({
      ...base,
      description: "",
      dueDate: "",
      assigneeId: "",
      gameId: "",
    });
    expect(parsed.description).toBeNull();
    expect(parsed.dueDate).toBeNull();
    expect(parsed.assigneeId).toBeNull();
    expect(parsed.gameId).toBeNull();
  });

  it("trims the title and rejects an empty one", () => {
    expect(taskFormSchema.parse({ ...base, title: "  งาน  " }).title).toBe(
      "งาน",
    );
    expect(taskFormSchema.safeParse({ ...base, title: "   " }).success).toBe(
      false,
    );
  });

  it("rejects a due date before the start date", () => {
    const result = taskFormSchema.safeParse({
      ...base,
      startDate: "2026-08-26",
      dueDate: "2026-08-25",
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(["dueDate"]);
  });

  it("allows a due date equal to the start date", () => {
    expect(
      taskFormSchema.safeParse({ ...base, dueDate: "2026-08-26" }).success,
    ).toBe(true);
  });

  it("rejects a malformed date", () => {
    expect(
      taskFormSchema.safeParse({ ...base, startDate: "26/08/2026" }).success,
    ).toBe(false);
  });

  it("rejects an unknown status", () => {
    expect(
      taskFormSchema.safeParse({ ...base, status: "ARCHIVED" }).success,
    ).toBe(false);
  });
});

describe("moveTaskSchema", () => {
  it("accepts a well-formed move", () => {
    expect(
      moveTaskSchema.safeParse({
        taskId: "abc",
        status: TaskStatus.DOING,
        toIndex: 0,
      }).success,
    ).toBe(true);
  });

  it("rejects a negative or fractional index", () => {
    const bad = { taskId: "abc", status: TaskStatus.DOING };
    expect(moveTaskSchema.safeParse({ ...bad, toIndex: -1 }).success).toBe(
      false,
    );
    expect(moveTaskSchema.safeParse({ ...bad, toIndex: 1.5 }).success).toBe(
      false,
    );
  });
});

describe("overdue and date display", () => {
  it("marks an unfinished past-due task as overdue", () => {
    expect(isOverdue("2026-08-25", TaskStatus.TODO, "2026-08-26")).toBe(true);
  });

  it("never marks a finished task overdue", () => {
    expect(isOverdue("2026-08-25", TaskStatus.DONE, "2026-08-26")).toBe(false);
  });

  it("does not mark a task due today as overdue", () => {
    expect(isOverdue("2026-08-26", TaskStatus.TODO, "2026-08-26")).toBe(false);
  });

  it("handles a missing due date", () => {
    expect(isOverdue(null, TaskStatus.TODO, "2026-08-26")).toBe(false);
  });

  it("counts whole days across a month boundary", () => {
    expect(daysBetween("2026-08-30", "2026-09-02")).toBe(3);
    expect(daysBetween("2026-08-26", "2026-08-25")).toBe(-1);
  });

  it("formats dates in Thai with the Buddhist year", () => {
    expect(formatThaiDate("2026-08-26")).toBe("26 ส.ค. 2569");
    expect(formatThaiDate("2026-01-01")).toBe("1 ม.ค. 2569");
  });
});
