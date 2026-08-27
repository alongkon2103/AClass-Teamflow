import { Role } from "@prisma/client";

/**
 * Central RBAC rules (SPEC section 4). Every server action and query filter must
 * go through `can()` — never re-implement role checks inline, and never rely on
 * hidden UI alone.
 */

/** Minimal actor shape; anything with these fields can be authorized. */
export type Actor = {
  id: string;
  role: Role;
};

/** Resources an action can target. Shapes stay minimal so services can pass slices. */
export type TaskResource = {
  /** Every user currently assigned to the task; a task may be shared. */
  assigneeIds: string[];
  createdById?: string;
};
export type ProgressResource = { authorId: string };
export type LeaveResource = { userId: string };

export type Action =
  // tasks
  | { type: "task:viewAll" }
  | { type: "task:view"; task: TaskResource }
  | { type: "task:create"; assigneeIds?: string[] }
  | { type: "task:update"; task: TaskResource }
  | { type: "task:delete"; task: TaskResource }
  | { type: "task:assign" }
  // progress
  | { type: "progress:create"; task: TaskResource }
  | { type: "progress:delete"; entry: ProgressResource }
  | { type: "progress:reply" }
  // games
  | { type: "game:manage" }
  // feedback
  | { type: "feedback:create" }
  | { type: "feedback:reply" }
  // leave
  | { type: "leave:request"; leave: LeaveResource }
  | { type: "leave:decide" }
  // members
  | { type: "member:manage" }
  // dashboard
  | { type: "dashboard:view" };

const isLeader = (actor: Actor) => actor.role === Role.LEADER;
const ownsTask = (actor: Actor, task: TaskResource) =>
  task.assigneeIds.includes(actor.id);

export function can(actor: Actor, action: Action): boolean {
  switch (action.type) {
    // --- Tasks --------------------------------------------------------------
    case "task:viewAll":
    case "dashboard:view":
    case "task:assign":
      return isLeader(actor);

    case "task:view":
    case "task:update":
    case "task:delete":
      // Leaders act on any task; members only on tasks assigned to them.
      return isLeader(actor) || ownsTask(actor, action.task);

    case "task:create":
      // Members may only create tasks for themselves (assigning is leader-only).
      return (
        isLeader(actor) ||
        action.assigneeIds === undefined ||
        action.assigneeIds.length === 0 ||
        (action.assigneeIds.length === 1 && action.assigneeIds[0] === actor.id)
      );

    // --- Progress -----------------------------------------------------------
    case "progress:create":
      return isLeader(actor) || ownsTask(actor, action.task);

    case "progress:delete":
      // Members may delete only entries they authored.
      return isLeader(actor) || action.entry.authorId === actor.id;

    // --- Games / feedback / members ----------------------------------------
    case "game:manage":
    case "progress:reply":
    case "feedback:reply":
    case "member:manage":
    case "leave:decide":
      return isLeader(actor);

    case "feedback:create":
      return true;

    // --- Leave --------------------------------------------------------------
    case "leave:request":
      // Leaders can file leave on anyone's behalf; members only for themselves.
      return isLeader(actor) || action.leave.userId === actor.id;

    default: {
      // Exhaustiveness guard: a new Action variant must be handled explicitly.
      const _never: never = action;
      return _never;
    }
  }
}

/**
 * Whether the actor may change who a task is assigned to. Members can edit their
 * own tasks but must never reassign them (SPEC section 4).
 */
export function canChangeAssignee(actor: Actor): boolean {
  return isLeader(actor);
}

/**
 * Prisma `where` fragment scoping task queries to what the actor may see.
 * Leaders see everything; members see only their own tasks.
 */
export function taskVisibilityFilter(actor: Actor): {
  assignees?: { some: { userId: string } };
} {
  // Members see every task they are one of the assignees on.
  return isLeader(actor) ? {} : { assignees: { some: { userId: actor.id } } };
}

/** Landing route after login / when a member hits a leader-only page. */
export function defaultRouteFor(role: Role): "/dashboard" | "/board" {
  return role === Role.LEADER ? "/dashboard" : "/board";
}

/** Throwing variant for server actions: fail loudly instead of returning data. */
export class ForbiddenError extends Error {
  constructor(message = "คุณไม่มีสิทธิ์ทำรายการนี้") {
    super(message);
    this.name = "ForbiddenError";
  }
}

export function assertCan(actor: Actor, action: Action): void {
  if (!can(actor, action)) {
    throw new ForbiddenError();
  }
}
