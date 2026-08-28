import { describe, expect, it } from "vitest";
import { TaskStatus } from "@prisma/client";
import {
  deliveryState,
  worstDeliveryState,
  DELIVERY_META,
  type DeliveryState,
} from "@/lib/delivery";
import { meetingFormSchema } from "@/lib/validators/meeting";
import { can } from "@/lib/permissions";

const TODAY = "2026-08-28";

describe("deliveryState", () => {
  const at = (over: Partial<Parameters<typeof deliveryState>[0]>) =>
    deliveryState({
      status: TaskStatus.TODO,
      dueDate: null,
      completedAt: null,
      today: TODAY,
      ...over,
    });

  it("is green when the work finished on the due date", () => {
    expect(
      at({
        status: TaskStatus.DONE,
        dueDate: "2026-08-28",
        completedAt: "2026-08-28",
      }),
    ).toBe("onTime");
  });

  it("is green when it finished early", () => {
    expect(
      at({
        status: TaskStatus.DONE,
        dueDate: "2026-08-28",
        completedAt: "2026-08-20",
      }),
    ).toBe("onTime");
  });

  it("is orange when it finished after the due date", () => {
    // The example from the request: due on the 1st, delivered on the 2nd.
    expect(
      at({
        status: TaskStatus.DONE,
        dueDate: "2026-09-01",
        completedAt: "2026-09-02",
      }),
    ).toBe("late");
  });

  it("is purple while it waits to be checked", () => {
    expect(at({ status: TaskStatus.REVIEW, dueDate: "2026-08-01" })).toBe(
      "review",
    );
  });

  it("stays purple in review even once the due date has passed", () => {
    // Handed in counts as delivered; the check being slow is not the member's
    // miss, so it must not turn red.
    expect(at({ status: TaskStatus.REVIEW, dueDate: "2026-01-01" })).toBe(
      "review",
    );
  });

  it("is red when the due date has passed and nothing was handed in", () => {
    expect(at({ status: TaskStatus.DOING, dueDate: "2026-08-27" })).toBe(
      "missed",
    );
  });

  it("is not red on the due date itself", () => {
    expect(at({ status: TaskStatus.DOING, dueDate: TODAY })).toBe("waiting");
  });

  it("never calls a task late without a recorded delivery day", () => {
    // Tasks finished before the column existed have no completedAt.
    expect(
      at({
        status: TaskStatus.DONE,
        dueDate: "2026-01-01",
        completedAt: null,
      }),
    ).toBe("onTime");
  });

  it("treats a task with no due date as never late", () => {
    expect(at({ status: TaskStatus.DOING, dueDate: null })).toBe("waiting");
    expect(
      at({ status: TaskStatus.DONE, dueDate: null, completedAt: "2026-09-09" }),
    ).toBe("onTime");
  });
});

describe("worstDeliveryState", () => {
  it("surfaces the most urgent state on a shared day", () => {
    expect(worstDeliveryState(["onTime", "missed", "review"])).toBe("missed");
    expect(worstDeliveryState(["onTime", "late"])).toBe("late");
    expect(worstDeliveryState(["onTime", "waiting"])).toBe("waiting");
  });

  it("falls back to delivered when nothing is outstanding", () => {
    expect(worstDeliveryState(["onTime"])).toBe("onTime");
    expect(worstDeliveryState([])).toBe("onTime");
  });
});

describe("delivery colours", () => {
  const states: DeliveryState[] = [
    "waiting",
    "review",
    "onTime",
    "late",
    "missed",
  ];

  it("labels and colours every state", () => {
    for (const state of states) {
      expect(DELIVERY_META[state].label).toBeTruthy();
      expect(DELIVERY_META[state].mark).toBeTruthy();
      expect(DELIVERY_META[state].ink).toBeTruthy();
    }
  });

  it("uses the colours the request asked for", () => {
    expect(DELIVERY_META.review.mark).toContain("review"); // purple
    expect(DELIVERY_META.onTime.mark).toContain("done"); // green
    expect(DELIVERY_META.missed.mark).toContain("danger"); // red
    expect(DELIVERY_META.late.mark).toContain("leave"); // orange
  });

  it("keeps every state visually distinct", () => {
    const marks = states.map((state) => DELIVERY_META[state].mark);
    expect(new Set(marks).size).toBe(marks.length);
  });
});

describe("meetingFormSchema", () => {
  const base = {
    title: "ประชุมทีม",
    meetingAt: "2026-08-28",
    summary: "สรุปผล",
  };

  it("accepts a complete record and trims it", () => {
    const parsed = meetingFormSchema.parse({
      ...base,
      title: "  ประชุมทีม  ",
    });
    expect(parsed.title).toBe("ประชุมทีม");
  });

  it("requires a title, a date and a summary", () => {
    expect(meetingFormSchema.safeParse({ ...base, title: " " }).success).toBe(
      false,
    );
    expect(meetingFormSchema.safeParse({ ...base, summary: " " }).success).toBe(
      false,
    );
    expect(
      meetingFormSchema.safeParse({ ...base, meetingAt: "28/08/2026" }).success,
    ).toBe(false);
  });

  it("allows a long set of minutes", () => {
    expect(
      meetingFormSchema.safeParse({ ...base, summary: "ก".repeat(5000) })
        .success,
    ).toBe(true);
  });
});

describe("meeting permissions", () => {
  it("lets only a leader record minutes", () => {
    expect(can({ id: "l", role: "LEADER" }, { type: "meeting:manage" })).toBe(
      true,
    );
    expect(can({ id: "m", role: "MEMBER" }, { type: "meeting:manage" })).toBe(
      false,
    );
  });
});
