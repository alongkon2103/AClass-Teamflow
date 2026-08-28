import { TaskStatus } from "@prisma/client";

/**
 * How a task due on a given day turned out, used to colour the calendar.
 *
 *   waiting  — still on the way, not past its due date yet
 *   review   — handed in and awaiting a check
 *   onTime   — finished on or before the due date
 *   late     — finished, but after the due date
 *   missed   — past the due date and still not finished
 */
export type DeliveryState = "waiting" | "review" | "onTime" | "late" | "missed";

export function deliveryState(task: {
  status: TaskStatus;
  dueDate: string | null;
  completedAt: string | null;
  today: string;
}): DeliveryState {
  const { status, dueDate, completedAt, today } = task;

  if (status === TaskStatus.DONE) {
    // Without a recorded completion day there is nothing to prove lateness
    // with, so a finished task is reported as delivered rather than accused.
    if (!dueDate || !completedAt) return "onTime";
    return completedAt > dueDate ? "late" : "onTime";
  }

  if (status === TaskStatus.REVIEW) return "review";

  // ISO date strings compare correctly as text.
  if (dueDate && dueDate < today) return "missed";
  return "waiting";
}

export const DELIVERY_META: Record<
  DeliveryState,
  { label: string; mark: string; ink: string }
> = {
  waiting: {
    label: "ยังไม่ถึงกำหนด",
    mark: "var(--color-todo)",
    ink: "var(--color-todo-ink)",
  },
  review: {
    label: "รอส่งตรวจ",
    mark: "var(--color-review)",
    ink: "var(--color-review-ink)",
  },
  onTime: {
    label: "ส่งแล้ว",
    mark: "var(--color-done)",
    ink: "var(--color-done-ink)",
  },
  late: {
    label: "ส่งล่าช้า",
    mark: "var(--color-leave)",
    ink: "var(--color-leave-ink)",
  },
  missed: {
    label: "ส่งไม่ทันกำหนด",
    mark: "var(--color-danger)",
    ink: "var(--color-danger-ink)",
  },
};

/** The state that should colour a day cell when several tasks are due on it. */
const SEVERITY: DeliveryState[] = [
  "missed",
  "late",
  "review",
  "waiting",
  "onTime",
];

export function worstDeliveryState(states: DeliveryState[]): DeliveryState {
  for (const candidate of SEVERITY) {
    if (states.includes(candidate)) return candidate;
  }
  return "onTime";
}
