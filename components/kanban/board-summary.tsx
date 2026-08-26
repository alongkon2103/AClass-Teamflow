import { Avatar } from "@/components/shared/avatar";
import type { MemberOption } from "./types";

/** Owner strip above the board: who it belongs to and their headline counts. */
export function BoardSummary({
  owner,
  total,
  doing,
  done,
}: {
  owner: MemberOption;
  total: number;
  doing: number;
  done: number;
}) {
  const stats: { label: string; value: number; colour?: string }[] = [
    { label: "งานทั้งหมด", value: total },
    { label: "กำลังทำ", value: doing, colour: "var(--color-doing-ink)" },
    { label: "เสร็จสิ้น", value: done, colour: "var(--color-done-ink)" },
  ];

  return (
    <div className="border-line bg-surface mb-6 flex flex-wrap items-center gap-4 rounded-2xl border p-5 shadow-sm">
      <Avatar user={owner} size={48} />
      <div>
        <div className="text-[17px] font-extrabold">
          บอร์ดงานของ {owner.name}
        </div>
        <div className="text-muted-foreground text-xs">
          {owner.jobTitle ?? "ทีมงาน"}
        </div>
      </div>
      <div className="ml-auto flex gap-8">
        {stats.map((stat) => (
          <div key={stat.label} className="text-center">
            <div
              className="text-2xl font-extrabold"
              style={stat.colour ? { color: stat.colour } : undefined}
            >
              {stat.value}
            </div>
            <div className="text-muted-foreground text-[11px]">
              {stat.label}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
