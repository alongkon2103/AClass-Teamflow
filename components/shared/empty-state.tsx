import type { LucideIcon } from "lucide-react";

/**
 * Empty state (SPEC 6.4 #6): thin faded icon, one sentence saying what can be
 * done, at most one action. No illustration, no jokes.
 */
export function EmptyState({
  icon: Icon,
  message,
  action,
}: {
  icon: LucideIcon;
  message: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-12 text-center">
      <Icon
        size={28}
        strokeWidth={1.5}
        className="text-muted-foreground/60"
        aria-hidden="true"
      />
      <p className="text-muted-foreground text-sm">{message}</p>
      {action}
    </div>
  );
}
