import { TaskStatus } from "@prisma/client";
import { TASK_STATUS_META, TASK_STATUS_ORDER } from "@/lib/constants";

/**
 * Status split, drawn with stroke-dasharray rather than a charting library
 * (SPEC 5.2). The figure is decorative — the legend beside it carries the data,
 * so the SVG itself is hidden from assistive tech.
 */
export function StatusDonut({
  counts,
  total,
  completion,
  size = 190,
  stroke = 26,
}: {
  counts: Record<TaskStatus, number>;
  total: number;
  completion: number;
  size?: number;
  stroke?: number;
}) {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <div className="flex flex-wrap items-center gap-6">
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg width={size} height={size} aria-hidden="true">
          <circle
            r={radius}
            cx={size / 2}
            cy={size / 2}
            fill="none"
            stroke="var(--track)"
            strokeWidth={stroke}
          />
          {total > 0
            ? TASK_STATUS_ORDER.filter((status) => counts[status] > 0).map(
                (status) => {
                  const length = (counts[status] / total) * circumference;
                  const dash = (
                    <circle
                      key={status}
                      r={radius}
                      cx={size / 2}
                      cy={size / 2}
                      fill="none"
                      stroke={TASK_STATUS_META[status].mark}
                      strokeWidth={stroke}
                      strokeDasharray={`${length} ${circumference - length}`}
                      strokeDashoffset={-offset}
                      transform={`rotate(-90 ${size / 2} ${size / 2})`}
                    />
                  );
                  offset += length;
                  return dash;
                },
              )
            : null}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-[34px] leading-none font-extrabold">
            {completion}%
          </span>
          <span className="text-muted-foreground mt-1 text-xs">
            อัตราเสร็จสิ้น
          </span>
        </div>
      </div>

      <ul className="flex min-w-[140px] flex-1 flex-col gap-3">
        {TASK_STATUS_ORDER.map((status) => {
          const meta = TASK_STATUS_META[status];
          const percent =
            total === 0 ? 0 : Math.round((counts[status] / total) * 100);
          return (
            <li key={status} className="flex items-center gap-2.5">
              <span
                aria-hidden="true"
                className="size-2.5 shrink-0 rounded-full"
                style={{ background: meta.mark }}
              />
              <span className="flex-1 text-[13px]">{meta.label}</span>
              <span className="text-[13px] font-bold">
                {counts[status]} งาน ({percent}%)
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
