import { describe, expect, it } from "vitest";
import { Role } from "@prisma/client";
import {
  can,
  assertCan,
  canChangeAssignee,
  taskVisibilityFilter,
  defaultRouteFor,
  ForbiddenError,
  type Actor,
} from "@/lib/permissions";

const leader: Actor = { id: "leader-1", role: Role.LEADER };
const member: Actor = { id: "member-1", role: Role.MEMBER };
const otherMember: Actor = { id: "member-2", role: Role.MEMBER };

const ownTask = { assigneeIds: [member.id], createdById: leader.id };
const foreignTask = { assigneeIds: [otherMember.id], createdById: leader.id };
const unassignedTask = { assigneeIds: [], createdById: leader.id };

describe("task permissions", () => {
  it("lets only leaders view all tasks and the dashboard", () => {
    expect(can(leader, { type: "task:viewAll" })).toBe(true);
    expect(can(member, { type: "task:viewAll" })).toBe(false);
    expect(can(leader, { type: "dashboard:view" })).toBe(true);
    expect(can(member, { type: "dashboard:view" })).toBe(false);
  });

  it("lets a member act only on tasks assigned to them", () => {
    expect(can(member, { type: "task:view", task: ownTask })).toBe(true);
    expect(can(member, { type: "task:update", task: ownTask })).toBe(true);
    expect(can(member, { type: "task:delete", task: ownTask })).toBe(true);

    expect(can(member, { type: "task:view", task: foreignTask })).toBe(false);
    expect(can(member, { type: "task:update", task: foreignTask })).toBe(false);
    expect(can(member, { type: "task:delete", task: foreignTask })).toBe(false);
  });

  it("lets a leader act on any task, including unassigned ones", () => {
    expect(can(leader, { type: "task:update", task: foreignTask })).toBe(true);
    expect(can(leader, { type: "task:update", task: unassignedTask })).toBe(
      true,
    );
  });

  it("allows only leaders to assign work to others", () => {
    expect(can(leader, { type: "task:assign" })).toBe(true);
    expect(can(member, { type: "task:assign" })).toBe(false);
    expect(canChangeAssignee(leader)).toBe(true);
    expect(canChangeAssignee(member)).toBe(false);
  });

  it("restricts member task creation to themselves", () => {
    expect(can(member, { type: "task:create", assigneeIds: [member.id] })).toBe(
      true,
    );
    expect(can(member, { type: "task:create" })).toBe(true);
    expect(can(member, { type: "task:create", assigneeIds: [] })).toBe(true);
    expect(
      can(member, { type: "task:create", assigneeIds: [otherMember.id] }),
    ).toBe(false);
    // Even including themselves, a member cannot pull someone else in.
    expect(
      can(member, {
        type: "task:create",
        assigneeIds: [member.id, otherMember.id],
      }),
    ).toBe(false);
    expect(
      can(leader, { type: "task:create", assigneeIds: [otherMember.id] }),
    ).toBe(true);
  });

  describe("shared tasks", () => {
    it("lets every assignee act on a task they share", () => {
      const shared = { assigneeIds: [member.id, otherMember.id] };
      expect(can(member, { type: "task:update", task: shared })).toBe(true);
      expect(can(otherMember, { type: "task:update", task: shared })).toBe(
        true,
      );
      expect(can(member, { type: "progress:create", task: shared })).toBe(true);
      expect(can(otherMember, { type: "progress:create", task: shared })).toBe(
        true,
      );
    });

    it("still shuts out someone who is not on the task", () => {
      const shared = { assigneeIds: [otherMember.id] };
      expect(can(member, { type: "task:update", task: shared })).toBe(false);
      expect(can(member, { type: "task:delete", task: shared })).toBe(false);
      expect(can(member, { type: "progress:create", task: shared })).toBe(
        false,
      );
    });

    it("gives nobody but a leader rights on an unassigned task", () => {
      const orphan = { assigneeIds: [] };
      expect(can(member, { type: "task:update", task: orphan })).toBe(false);
      expect(can(leader, { type: "task:update", task: orphan })).toBe(true);
    });
  });
});

describe("progress permissions", () => {
  it("allows progress only on tasks the member owns", () => {
    expect(can(member, { type: "progress:create", task: ownTask })).toBe(true);
    expect(can(member, { type: "progress:create", task: foreignTask })).toBe(
      false,
    );
    expect(can(leader, { type: "progress:create", task: foreignTask })).toBe(
      true,
    );
  });

  it("allows deleting only entries the member authored", () => {
    expect(
      can(member, { type: "progress:delete", entry: { authorId: member.id } }),
    ).toBe(true);
    expect(
      can(member, {
        type: "progress:delete",
        entry: { authorId: otherMember.id },
      }),
    ).toBe(false);
    // Leaders may remove anyone's entry.
    expect(
      can(leader, {
        type: "progress:delete",
        entry: { authorId: otherMember.id },
      }),
    ).toBe(true);
  });
});

describe("games, feedback, members", () => {
  it("restricts game and member management to leaders", () => {
    expect(can(leader, { type: "game:manage" })).toBe(true);
    expect(can(member, { type: "game:manage" })).toBe(false);
    expect(can(leader, { type: "member:manage" })).toBe(true);
    expect(can(member, { type: "member:manage" })).toBe(false);
  });

  it("lets anyone create feedback but only leaders reply", () => {
    expect(can(member, { type: "feedback:create" })).toBe(true);
    expect(can(leader, { type: "feedback:create" })).toBe(true);
    expect(can(member, { type: "feedback:reply" })).toBe(false);
    expect(can(leader, { type: "feedback:reply" })).toBe(true);
  });
});

describe("leave permissions", () => {
  it("lets members request leave only for themselves", () => {
    expect(
      can(member, { type: "leave:request", leave: { userId: member.id } }),
    ).toBe(true);
    expect(
      can(member, { type: "leave:request", leave: { userId: otherMember.id } }),
    ).toBe(false);
  });

  it("lets leaders request on anyone's behalf and decide", () => {
    expect(
      can(leader, { type: "leave:request", leave: { userId: member.id } }),
    ).toBe(true);
    expect(can(leader, { type: "leave:decide" })).toBe(true);
    expect(can(member, { type: "leave:decide" })).toBe(false);
  });
});

describe("query scoping and routing", () => {
  it("scopes task queries to tasks the member is assigned to", () => {
    expect(taskVisibilityFilter(leader)).toEqual({});
    // Matches a shared task too: the member only has to be one of the assignees.
    expect(taskVisibilityFilter(member)).toEqual({
      assignees: { some: { userId: member.id } },
    });
  });

  it("routes each role to its landing page", () => {
    expect(defaultRouteFor(Role.LEADER)).toBe("/dashboard");
    expect(defaultRouteFor(Role.MEMBER)).toBe("/board");
  });
});

describe("assertCan", () => {
  it("throws ForbiddenError when denied and stays silent when allowed", () => {
    expect(() =>
      assertCan(member, { type: "task:update", task: foreignTask }),
    ).toThrow(ForbiddenError);
    expect(() =>
      assertCan(member, { type: "task:update", task: ownTask }),
    ).not.toThrow();
  });
});
