import type { TaskStatus, Priority, FeedbackStatus } from "@prisma/client";
import {
  TASK_STATUS_META,
  PRIORITY_META,
  FEEDBACK_STATUS_META,
} from "@/lib/constants";

/**
 * Badges are full-strength ink text on a tint of the same hue (SPEC 6.1).
 * `color-mix` produces the tint from the mark colour so the two always match.
 */
function Pill({
  mark,
  ink,
  children,
  withDot = false,
}: {
  mark: string;
  ink: string;
  children: React.ReactNode;
  withDot?: boolean;
}) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold whitespace-nowrap"
      style={{
        color: ink,
        background: `color-mix(in srgb, ${mark} 16%, transparent)`,
      }}
    >
      {withDot ? (
        <span
          aria-hidden="true"
          className="size-1.5 shrink-0 rounded-full"
          style={{ background: mark }}
        />
      ) : null}
      {children}
    </span>
  );
}

export function StatusBadge({ status }: { status: TaskStatus }) {
  const meta = TASK_STATUS_META[status];
  return (
    <Pill mark={meta.mark} ink={meta.ink} withDot>
      {meta.label}
    </Pill>
  );
}

export function PriorityBadge({ priority }: { priority: Priority }) {
  const meta = PRIORITY_META[priority];
  return (
    <Pill mark={meta.mark} ink={meta.ink}>
      {meta.label}
    </Pill>
  );
}

export function FeedbackStatusBadge({ status }: { status: FeedbackStatus }) {
  const meta = FEEDBACK_STATUS_META[status];
  return (
    <Pill mark={meta.mark} ink={meta.ink}>
      {meta.label}
    </Pill>
  );
}
