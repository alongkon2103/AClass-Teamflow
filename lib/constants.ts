import {
  Archive,
  Briefcase,
  CalendarDays,
  CirclePlay,
  CircleCheck,
  ClipboardList,
  Columns3,
  Eye,
  LayoutGrid,
  MessageSquare,
  NotebookPen,
  type LucideIcon,
} from "lucide-react";
import {
  TaskStatus,
  Priority,
  FeedbackStatus,
  LeaveStatus,
} from "@prisma/client";

/**
 * Single source of truth for Thai labels and colour roles.
 * `mark` is the SPEC-exact colour used for dots, rules and fills; `ink` is the
 * AA-compliant text variant. Never use a mark colour for text.
 */
type Meta = {
  label: string;
  mark: string;
  ink: string;
  icon: LucideIcon;
  caption: string;
};

export const TASK_STATUS_META: Record<TaskStatus, Meta> = {
  [TaskStatus.TODO]: {
    label: "ต้องทำ",
    mark: "var(--color-todo)",
    ink: "var(--color-todo-ink)",
    icon: ClipboardList,
    caption: "รอเริ่มดำเนินการ",
  },
  [TaskStatus.DOING]: {
    label: "กำลังทำ",
    mark: "var(--color-doing)",
    ink: "var(--color-doing-ink)",
    icon: CirclePlay,
    caption: "กำลังทำอยู่ตอนนี้",
  },
  [TaskStatus.REVIEW]: {
    label: "รอส่งตรวจ",
    mark: "var(--color-review)",
    ink: "var(--color-review-ink)",
    icon: Eye,
    caption: "รอตรวจและอนุมัติ",
  },
  [TaskStatus.DONE]: {
    label: "เสร็จสิ้นแล้ว",
    mark: "var(--color-done)",
    ink: "var(--color-done-ink)",
    icon: CircleCheck,
    caption: "เสร็จเรียบร้อยแล้ว",
  },
};

/** Kanban column order (SPEC 5.3). */
export const TASK_STATUS_ORDER: TaskStatus[] = [
  TaskStatus.TODO,
  TaskStatus.DOING,
  TaskStatus.REVIEW,
  TaskStatus.DONE,
];

export const PRIORITY_META: Record<
  Priority,
  { label: string; mark: string; ink: string }
> = {
  [Priority.NORMAL]: {
    label: "ปกติ",
    mark: "var(--color-todo)",
    ink: "var(--color-todo-ink)",
  },
  [Priority.IMPORTANT]: {
    label: "สำคัญ",
    mark: "var(--color-doing)",
    ink: "var(--color-doing-ink)",
  },
  [Priority.URGENT]: {
    label: "ด่วน",
    mark: "var(--color-danger)",
    ink: "var(--color-danger-ink)",
  },
};

export const FEEDBACK_STATUS_META: Record<
  FeedbackStatus,
  { label: string; mark: string; ink: string }
> = {
  [FeedbackStatus.PENDING]: {
    label: "รอดำเนินการ",
    mark: "var(--color-muted-foreground)",
    ink: "var(--color-muted-foreground)",
  },
  [FeedbackStatus.FIXING]: {
    label: "จะแก้ไข",
    mark: "var(--color-doing)",
    ink: "var(--color-doing-ink)",
  },
  [FeedbackStatus.RESOLVED]: {
    label: "แก้ไขสำเร็จ",
    mark: "var(--color-done)",
    ink: "var(--color-done-ink)",
  },
  [FeedbackStatus.DISMISSED]: {
    label: "ปัดตก",
    mark: "var(--color-danger)",
    ink: "var(--color-danger-ink)",
  },
};

export const LEAVE_STATUS_META: Record<
  LeaveStatus,
  { label: string; mark: string; ink: string }
> = {
  [LeaveStatus.PENDING]: {
    label: "รออนุมัติ",
    mark: "var(--color-leave)",
    ink: "var(--color-leave-ink)",
  },
  [LeaveStatus.APPROVED]: {
    label: "อนุมัติแล้ว",
    mark: "var(--color-leave)",
    ink: "var(--color-leave-ink)",
  },
  [LeaveStatus.REJECTED]: {
    label: "ไม่อนุมัติ",
    mark: "var(--color-danger)",
    ink: "var(--color-danger-ink)",
  },
};

/** Avatar colours assigned to new members (SPEC 5.8). */
export const AVATAR_PALETTE = [
  "#2E7CF6",
  "#00B894",
  "#E17055",
  "#8E5BF5",
  "#E84393",
  "#F5A623",
  "#28C76F",
  "#0EA5C4",
] as const;

/** Primary navigation (SPEC 6.3 icon mapping). */
export const NAV_ITEMS = [
  {
    href: "/dashboard",
    label: "ภาพรวม",
    icon: LayoutGrid,
    leaderOnly: true,
  },
  { href: "/board", label: "บอร์ดคัมบัง", icon: Columns3, leaderOnly: false },
  { href: "/calendar", label: "ปฏิทิน", icon: CalendarDays, leaderOnly: false },
  {
    href: "/meetings",
    label: "ประชุม",
    icon: NotebookPen,
    leaderOnly: false,
  },
  {
    href: "/feedback",
    label: "Feedback",
    icon: MessageSquare,
    leaderOnly: false,
  },
  { href: "/archive", label: "คลังงาน", icon: Archive, leaderOnly: false },
] as const;

export const TOTAL_TASKS_META = {
  label: "งานทั้งหมด",
  caption: "ทุกงานในระบบ",
  icon: Briefcase,
  mark: "var(--color-primary)",
};
