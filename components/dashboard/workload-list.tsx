import Link from "next/link";
import { Users } from "lucide-react";
import { Avatar } from "@/components/shared/avatar";
import { EmptyState } from "@/components/shared/empty-state";

type WorkloadRow = {
  id: string;
  name: string;
  jobTitle: string | null;
  avatarColor: string;
  total: number;
  done: number;
  percent: number;
};

/**
 * Per-member progress. The bar is the second and last place a gradient is
 * allowed (SPEC 6.4 #1).
 */
export function WorkloadList({ rows }: { rows: WorkloadRow[] }) {
  if (rows.length === 0) {
    return <EmptyState icon={Users} message="ยังไม่มีสมาชิกในทีม" />;
  }

  return (
    <ul className="flex flex-col gap-5">
      {rows.map((row) => (
        <li key={row.id}>
          <Link
            href={`/board?user=${row.id}`}
            className="block rounded-xl"
            aria-label={`ดูบอร์ดของ ${row.name}`}
          >
            <div className="mb-2 flex items-center gap-2.5">
              <Avatar user={row} size={30} />
              <span className="text-[13px] font-bold">{row.name}</span>
              {row.jobTitle ? (
                <span className="text-muted-foreground text-xs">
                  · {row.jobTitle}
                </span>
              ) : null}
              <span className="text-muted-foreground ml-auto text-xs font-semibold">
                {row.done} / {row.total} งานสำเร็จ ({row.percent}%)
              </span>
            </div>
            <div className="bg-track h-2 overflow-hidden rounded-full">
              <div
                className="h-full rounded-full transition-[width] duration-200"
                style={{
                  width: `${row.percent}%`,
                  background: "linear-gradient(90deg,#2E7CF6,#5EA0FF)",
                }}
              />
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
