import { describe, expect, it } from "vitest";
import { TaskStatus } from "@prisma/client";
import {
  deliveryState,
  worstDeliveryState,
  DELIVERY_META,
  type DeliveryState,
} from "@/lib/delivery";
import { meetingFormSchema } from "@/lib/validators/meeting";
import { plainToRichText, richTextToPlain } from "@/lib/rich-text";
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
  const base = { title: "ประชุมทีม", meetingAt: "2026-08-28" };

  it("books a meeting with only a title and a date", () => {
    // Nothing has happened yet, so there is no write-up to demand.
    const parsed = meetingFormSchema.parse(base);
    expect(parsed.summary).toBeNull();
    expect(parsed.startTime).toBeNull();
    expect(parsed.description).toBeNull();
  });

  it("keeps a time, an agenda and a write-up when given", () => {
    const parsed = meetingFormSchema.parse({
      ...base,
      startTime: "14:30",
      description: plainToRichText("วาระที่ 1"),
      summary: plainToRichText("สรุปผล"),
    });
    expect(parsed.startTime).toBe("14:30");
    expect(richTextToPlain(parsed.description)).toBe("วาระที่ 1");
    expect(richTextToPlain(parsed.summary)).toBe("สรุปผล");
  });

  it("stores a document the editor left blank as no write-up at all", () => {
    // TipTap keeps an empty paragraph around after the field is cleared.
    const parsed = meetingFormSchema.parse({
      ...base,
      summary: { type: "doc", content: [{ type: "paragraph" }] },
    });
    expect(parsed.summary).toBeNull();
  });

  it("trims the title and still requires one", () => {
    expect(
      meetingFormSchema.parse({ ...base, title: "  ประชุม  " }).title,
    ).toBe("ประชุม");
    expect(meetingFormSchema.safeParse({ ...base, title: " " }).success).toBe(
      false,
    );
  });

  it("requires a well-formed date", () => {
    expect(
      meetingFormSchema.safeParse({ ...base, meetingAt: "28/08/2026" }).success,
    ).toBe(false);
  });

  it("accepts a 24-hour clock and rejects anything else", () => {
    for (const time of ["00:00", "09:05", "23:59"]) {
      expect(
        meetingFormSchema.safeParse({ ...base, startTime: time }).success,
      ).toBe(true);
    }
    for (const time of ["24:00", "9:05", "13:60", "บ่ายสอง", "14.30"]) {
      expect(
        meetingFormSchema.safeParse({ ...base, startTime: time }).success,
      ).toBe(false);
    }
  });

  it("treats an empty time as no time set, not an error", () => {
    expect(
      meetingFormSchema.parse({ ...base, startTime: "" }).startTime,
    ).toBeNull();
  });

  it("allows a long set of minutes", () => {
    expect(
      meetingFormSchema.safeParse({
        ...base,
        summary: plainToRichText("ก".repeat(5000)),
      }).success,
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
