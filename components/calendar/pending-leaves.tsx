"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { LeaveStatus } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/shared/avatar";
import { formatThaiDate } from "@/lib/format";
import { decideLeaveAction } from "@/server/actions/leave";

type PendingLeave = {
  id: string;
  startDate: string;
  endDate: string;
  reason: string | null;
  user: { id: string; name: string; avatarColor: string };
};

/** Leader-only approval queue (SPEC 5.5). */
export function PendingLeaves({ leaves }: { leaves: PendingLeave[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  if (leaves.length === 0) return null;

  const decide = (id: string, status: LeaveStatus) => {
    startTransition(async () => {
      const result = await decideLeaveAction({ id, status });
      if (result.ok) {
        toast.success(
          status === LeaveStatus.APPROVED
            ? "อนุมัติการลาแล้ว"
            : "ปฏิเสธการลาแล้ว",
        );
        router.refresh();
      } else {
        toast.error(result.message);
      }
    });
  };

  return (
    <section className="border-line bg-surface mb-4 rounded-[18px] border p-5 shadow-sm">
      <h2 className="mb-3 text-[15.5px] font-bold">
        คำขอลาที่รออนุมัติ
        <span className="text-muted-foreground ml-2 text-xs font-semibold">
          {leaves.length} รายการ
        </span>
      </h2>

      <ul className="flex flex-col gap-2">
        {leaves.map((leave) => (
          <li
            key={leave.id}
            className="flex flex-wrap items-center gap-3 rounded-xl p-3"
            style={{
              background:
                "color-mix(in srgb, var(--color-leave) 12%, transparent)",
            }}
          >
            <Avatar user={leave.user} size={30} />
            <div className="min-w-0">
              <p className="text-[13px] font-bold">{leave.user.name}</p>
              <p className="text-muted-foreground text-xs">
                {leave.startDate === leave.endDate
                  ? formatThaiDate(leave.startDate)
                  : `${formatThaiDate(leave.startDate)} – ${formatThaiDate(leave.endDate)}`}
                {leave.reason ? ` · ${leave.reason}` : ""}
              </p>
            </div>
            <div className="ml-auto flex gap-2">
              <Button
                type="button"
                size="sm"
                disabled={pending}
                onClick={() => decide(leave.id, LeaveStatus.APPROVED)}
              >
                อนุมัติ
              </Button>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                disabled={pending}
                onClick={() => decide(leave.id, LeaveStatus.REJECTED)}
              >
                ปฏิเสธ
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
