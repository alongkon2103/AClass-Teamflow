"use client";

import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { THAI_MONTHS_FULL } from "@/lib/format";
import type { CalendarMonth } from "@/server/services/calendar";
import { cn } from "@/lib/utils";

const WEEKDAYS = ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"];

/**
 * Month grid. Leave tints the whole cell orange; a request still awaiting a
 * decision uses a dashed border so PENDING and APPROVED stay distinguishable
 * without relying on colour alone (SPEC 5.5).
 */
export function MonthGrid({
  year,
  month,
  data,
  today,
  onSelectDay,
}: {
  year: number;
  month: number;
  data: CalendarMonth;
  today: string;
  onSelectDay: (day: string) => void;
}) {
  const router = useRouter();

  const firstWeekday = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const cells: (number | null)[] = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  const iso = (day: number) =>
    `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

  const go = (delta: number) => {
    const target = new Date(Date.UTC(year, month - 1 + delta, 1));
    router.push(
      `/calendar?year=${target.getUTCFullYear()}&month=${target.getUTCMonth() + 1}`,
    );
  };

  return (
    <div className="border-line bg-surface rounded-[18px] border p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <button
          type="button"
          onClick={() => go(-1)}
          aria-label="เดือนก่อนหน้า"
          className="border-line bg-hover hover:bg-primary-soft inline-flex size-10 items-center justify-center rounded-xl border"
        >
          <ChevronLeft size={17} strokeWidth={2} />
        </button>
        <h2 className="text-[17px] font-extrabold">
          {THAI_MONTHS_FULL[month - 1]} {year + 543}
        </h2>
        <button
          type="button"
          onClick={() => go(1)}
          aria-label="เดือนถัดไป"
          className="border-line bg-hover hover:bg-primary-soft inline-flex size-10 items-center justify-center rounded-xl border"
        >
          <ChevronRight size={17} strokeWidth={2} />
        </button>
      </div>

      <div className="mb-1.5 grid grid-cols-7 gap-1.5">
        {WEEKDAYS.map((label, index) => (
          <div
            key={label}
            className={cn(
              "py-1 text-center text-xs font-bold",
              index === 0 ? "text-danger-ink" : "text-muted-foreground",
            )}
          >
            {label}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1.5">
        {cells.map((day, index) => {
          if (day === null) return <div key={`pad-${index}`} />;

          const key = iso(day);
          const leaves = data.leavesByDay[key] ?? [];
          const progressCount = data.progressByDay[key] ?? 0;
          const dueCount = data.dueByDay[key] ?? 0;
          const isToday = key === today;
          const hasLeave = leaves.length > 0;
          const allPending =
            hasLeave && leaves.every((leave) => leave.status === "PENDING");

          const label =
            leaves.length === 1 ? leaves[0].name : `${leaves.length} คน`;

          return (
            <button
              key={key}
              type="button"
              onClick={() => onSelectDay(key)}
              aria-label={`วันที่ ${day} ${THAI_MONTHS_FULL[month - 1]}${
                hasLeave ? ` มีคนลา ${leaves.length} คน` : ""
              }${progressCount ? ` ความคืบหน้า ${progressCount} รายการ` : ""}${
                dueCount ? ` ครบกำหนด ${dueCount} งาน` : ""
              }`}
              className={cn(
                "flex min-h-[86px] flex-col gap-1 rounded-xl p-2 text-left transition-shadow duration-150",
                "hover:shadow-sm",
                isToday ? "border-primary border-2" : "border",
              )}
              style={{
                background: hasLeave
                  ? "color-mix(in srgb, var(--color-leave) 12%, var(--background))"
                  : "var(--background)",
                borderColor: isToday
                  ? undefined
                  : hasLeave
                    ? "color-mix(in srgb, var(--color-leave) 55%, transparent)"
                    : "var(--line)",
                borderStyle: hasLeave && allPending ? "dashed" : "solid",
              }}
            >
              <span
                className={cn(
                  "text-[13px] font-bold",
                  isToday ? "text-primary-ink" : "text-ink",
                )}
              >
                {day}
              </span>

              {hasLeave ? (
                <span
                  className="truncate rounded-md px-1.5 py-0.5 text-[10.5px] font-bold"
                  style={{
                    color: "var(--color-leave-ink)",
                    background:
                      "color-mix(in srgb, var(--color-leave) 22%, transparent)",
                  }}
                >
                  ลา · {label}
                </span>
              ) : null}

              {progressCount > 0 ? (
                <span className="text-primary-ink inline-flex items-center gap-1 text-[10.5px] font-semibold">
                  <span
                    aria-hidden="true"
                    className="bg-primary size-1.5 rounded-full"
                  />
                  {progressCount} อัพเดท
                </span>
              ) : null}

              {dueCount > 0 ? (
                <span className="text-danger-ink text-[10.5px] font-semibold">
                  ส่ง {dueCount} งาน
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      <ul className="text-muted-foreground mt-4 flex flex-wrap gap-5 text-xs">
        <li className="inline-flex items-center gap-1.5">
          <span
            aria-hidden="true"
            className="size-3 rounded"
            style={{
              background:
                "color-mix(in srgb, var(--color-leave) 30%, transparent)",
              border: "1px solid var(--color-leave)",
            }}
          />
          อนุมัติลาแล้ว
        </li>
        <li className="inline-flex items-center gap-1.5">
          <span
            aria-hidden="true"
            className="size-3 rounded"
            style={{
              background:
                "color-mix(in srgb, var(--color-leave) 30%, transparent)",
              border: "1px dashed var(--color-leave)",
            }}
          />
          รออนุมัติ
        </li>
        <li className="inline-flex items-center gap-1.5">
          <span aria-hidden="true" className="bg-primary size-2 rounded-full" />
          ส่งความคืบหน้า
        </li>
        <li className="inline-flex items-center gap-1.5">
          <span
            aria-hidden="true"
            className="border-primary size-3 rounded border-2"
          />
          วันนี้
        </li>
      </ul>
    </div>
  );
}
