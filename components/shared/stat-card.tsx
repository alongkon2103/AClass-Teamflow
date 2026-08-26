import type { LucideIcon } from "lucide-react";

/**
 * Dashboard statistic (SPEC 5.2): icon, big number, short caption and a 4px
 * colour rule down the left edge. Numbers always carry a label (SPEC 6.4 #10).
 */
export function StatCard({
  label,
  caption,
  count,
  icon: Icon,
  mark,
}: {
  label: string;
  caption: string;
  count: number;
  icon: LucideIcon;
  mark: string;
}) {
  return (
    <div
      className="border-line bg-surface flex items-center gap-4 rounded-2xl border p-4 shadow-sm"
      style={{ borderLeft: `4px solid ${mark}` }}
    >
      <span
        aria-hidden="true"
        className="flex size-11 shrink-0 items-center justify-center rounded-xl"
        style={{
          color: mark,
          background: `color-mix(in srgb, ${mark} 14%, transparent)`,
        }}
      >
        <Icon size={21} strokeWidth={2} />
      </span>
      <div className="min-w-0">
        <div className="text-muted-foreground text-xs font-semibold">
          {label}
        </div>
        <div className="text-2xl leading-tight font-extrabold">
          {count.toLocaleString("th-TH")}
        </div>
        <div className="text-muted-foreground text-[11px]">{caption}</div>
      </div>
    </div>
  );
}
