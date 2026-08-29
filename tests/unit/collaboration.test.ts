import { describe, expect, it } from "vitest";
import { FeedbackStatus } from "@prisma/client";
import { can, taskVisibilityFilter } from "@/lib/permissions";
import { taskFormSchema } from "@/lib/validators/task";
import { replyProgressSchema } from "@/lib/validators/progress";
import { plainToRichText } from "@/lib/rich-text";
import { FEEDBACK_STATUS_META } from "@/lib/constants";
import {
  notificationHref,
  notificationMessage,
} from "@/server/services/notification";

const leader = { id: "leader-1", role: "LEADER" as const };
const alice = { id: "alice", role: "MEMBER" as const };
const bob = { id: "bob", role: "MEMBER" as const };

describe("shared tasks", () => {
  const shared = { assigneeIds: [alice.id, bob.id] };

  it("gives every assignee the same rights on the task", () => {
    for (const person of [alice, bob]) {
      expect(can(person, { type: "task:update", task: shared })).toBe(true);
      expect(can(person, { type: "progress:create", task: shared })).toBe(true);
      expect(can(person, { type: "task:delete", task: shared })).toBe(true);
    }
  });

  it("keeps everyone else out", () => {
    const outsider = { id: "carol", role: "MEMBER" as const };
    expect(can(outsider, { type: "task:update", task: shared })).toBe(false);
    expect(can(outsider, { type: "progress:create", task: shared })).toBe(
      false,
    );
  });

  it("scopes a member's board to tasks they are one of the assignees on", () => {
    expect(taskVisibilityFilter(alice)).toEqual({
      assignees: { some: { userId: alice.id } },
    });
  });

  it("never lets a member add a colleague to a task", () => {
    expect(
      can(alice, { type: "task:create", assigneeIds: [alice.id, bob.id] }),
    ).toBe(false);
    expect(can(alice, { type: "task:create", assigneeIds: [alice.id] })).toBe(
      true,
    );
  });

  it("accepts several assignees and strips blanks and repeats", () => {
    const parsed = taskFormSchema.parse({
      title: "งาน",
      status: "TODO",
      priority: "NORMAL",
      startDate: "2026-08-27",
      assigneeIds: ["a", "b", "a", ""],
    });
    expect(parsed.assigneeIds).toEqual(["a", "b"]);
  });

  it("treats an empty assignee list as unassigned rather than an error", () => {
    const parsed = taskFormSchema.parse({
      title: "งาน",
      status: "TODO",
      priority: "NORMAL",
      startDate: "2026-08-27",
    });
    expect(parsed.assigneeIds).toEqual([]);
  });
});

describe("free-text game name", () => {
  const base = {
    title: "งาน",
    status: "TODO" as const,
    priority: "NORMAL" as const,
    startDate: "2026-08-27",
  };

  it("keeps the typed name when no library game is chosen", () => {
    expect(
      taskFormSchema.parse({ ...base, gameId: "", gameNote: " เกมใหม่ " })
        .gameNote,
    ).toBe("เกมใหม่");
  });

  it("drops the typed name once a library game is chosen", () => {
    const parsed = taskFormSchema.parse({
      ...base,
      gameId: "game-1",
      gameNote: "พิมพ์ทิ้งไว้",
    });
    expect(parsed.gameId).toBe("game-1");
    expect(parsed.gameNote).toBeNull();
  });

  it("leaves both empty when nothing is given", () => {
    const parsed = taskFormSchema.parse(base);
    expect(parsed.gameId).toBeNull();
    expect(parsed.gameNote).toBeNull();
  });
});

describe("progress replies", () => {
  it("is leader-only", () => {
    expect(can(leader, { type: "progress:reply" })).toBe(true);
    expect(can(alice, { type: "progress:reply" })).toBe(false);
  });

  it("lets an author delete their own reply, and a leader delete any", () => {
    expect(
      can(alice, { type: "progress:delete", entry: { authorId: alice.id } }),
    ).toBe(true);
    expect(
      can(alice, { type: "progress:delete", entry: { authorId: bob.id } }),
    ).toBe(false);
    expect(
      can(leader, { type: "progress:delete", entry: { authorId: bob.id } }),
    ).toBe(true);
  });

  it("requires a reply that actually says something", () => {
    expect(
      replyProgressSchema.safeParse({
        entryId: "e1",
        body: plainToRichText("ดีมาก"),
      }).success,
    ).toBe(true);
    // An empty paragraph is what TipTap leaves behind, and it is not a reply.
    expect(
      replyProgressSchema.safeParse({
        entryId: "e1",
        body: { type: "doc", content: [{ type: "paragraph" }] },
      }).success,
    ).toBe(false);
    // A mention on its own is a reply: it pulls somebody in.
    expect(
      replyProgressSchema.safeParse({
        entryId: "e1",
        body: {
          type: "doc",
          content: [
            {
              type: "paragraph",
              content: [{ type: "mention", attrs: { id: "u1", label: "ปอ" } }],
            },
          ],
        },
      }).success,
    ).toBe(true);
  });

  it("points the notification at the task it belongs to", () => {
    expect(notificationHref("PROGRESS_REPLIED", { taskId: "t1" })).toBe(
      "/board?task=t1",
    );
    expect(
      notificationMessage(
        "PROGRESS_REPLIED",
        { taskTitle: "งาน A" },
        "หัวหน้า",
      ),
    ).toContain("ตอบกลับความคืบหน้า");
  });
});

describe("mention notifications", () => {
  it("takes the reader to the task the mention was written in", () => {
    expect(notificationHref("MENTIONED", { taskId: "t1" })).toBe(
      "/board?task=t1",
    );
  });

  it("takes the reader to the meeting when the mention was in the minutes", () => {
    expect(
      notificationHref("MENTIONED", { meetingId: "m1", meetingTitle: "สรุป" }),
    ).toBe("/meetings?meeting=m1");
  });

  it("falls back to the board when the payload names nothing", () => {
    expect(notificationHref("MENTIONED", {})).toBe("/board");
  });

  it("says who mentioned you and where", () => {
    expect(
      notificationMessage("MENTIONED", { taskTitle: "งาน A" }, "หัวหน้า"),
    ).toBe('หัวหน้า กล่าวถึงคุณใน "งาน A"');
    expect(
      notificationMessage(
        "MENTIONED",
        { meetingId: "m1", meetingTitle: "ประชุมทีม" },
        "หัวหน้า",
      ),
    ).toBe('หัวหน้า กล่าวถึงคุณในบันทึกประชุม "ประชุมทีม"');
  });
});

describe("feedback resolved state", () => {
  it("has a label and colours for every status", () => {
    for (const status of Object.values(FeedbackStatus)) {
      expect(FEEDBACK_STATUS_META[status]?.label).toBeTruthy();
      expect(FEEDBACK_STATUS_META[status]?.ink).toBeTruthy();
    }
  });

  it("labels the new terminal state", () => {
    expect(FEEDBACK_STATUS_META[FeedbackStatus.RESOLVED].label).toBe(
      "แก้ไขสำเร็จ",
    );
  });

  it("distinguishes in-progress from finished by colour", () => {
    expect(FEEDBACK_STATUS_META[FeedbackStatus.FIXING].mark).not.toBe(
      FEEDBACK_STATUS_META[FeedbackStatus.RESOLVED].mark,
    );
  });
});
