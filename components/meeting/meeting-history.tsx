"use client";

import { useState } from "react";
import { ChevronDown, NotebookPen, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Avatar } from "@/components/shared/avatar";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { formatThaiDate } from "@/lib/format";
import { deleteMeetingAction } from "@/server/actions/meeting";
import { cn } from "@/lib/utils";

export type MeetingView = {
  id: string;
  title: string;
  meetingAt: string;
  startTime: string | null;
  description: string | null;
  summary: string | null;
  createdBy: {
    id: string;
    name: string;
    avatarColor: string;
    avatarUrl: string | null;
  };
};

/**
 * Past meetings as a collapsible list: each row opens to reveal that meeting's
 * minutes, so the history stays scannable however long it gets.
 */
export function MeetingHistory({
  meetings,
  canManage,
  onEdit,
}: {
  meetings: MeetingView[];
  canManage: boolean;
  onEdit: (meeting: MeetingView) => void;
}) {
  const router = useRouter();
  const [openId, setOpenId] = useState<string | null>(meetings[0]?.id ?? null);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const remove = (id: string) =>
    startTransition(async () => {
      const result = await deleteMeetingAction({ id });
      if (result.ok) {
        toast.success("ลบรายการประชุมแล้ว");
        setConfirming(null);
        router.refresh();
      } else {
        toast.error(result.message);
      }
    });

  if (meetings.length === 0) {
    return (
      <div className="border-line bg-surface rounded-[18px] border">
        <EmptyState
          icon={NotebookPen}
          message="ยังไม่มีประวัติการประชุม บันทึกครั้งแรกได้จากฟอร์มด้านซ้าย"
        />
      </div>
    );
  }

  return (
    <div className="border-line bg-surface overflow-hidden rounded-[18px] border shadow-sm">
      <h2 className="border-line border-b px-4 py-3 text-[15.5px] font-bold">
        ประวัติการประชุม
        <span className="text-muted-foreground ml-2 text-xs font-semibold">
          {meetings.length} ครั้ง
        </span>
      </h2>

      <ul className="max-h-[70vh] overflow-y-auto">
        {meetings.map((meeting) => {
          const open = openId === meeting.id;
          return (
            <li key={meeting.id} className="border-line border-b last:border-0">
              <button
                type="button"
                onClick={() => setOpenId(open ? null : meeting.id)}
                aria-expanded={open}
                className="hover:bg-hover flex w-full items-center gap-3 px-4 py-3 text-left transition-colors duration-150"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-bold">
                    {meeting.title}
                  </span>
                  <span className="text-muted-foreground block text-[11px]">
                    {formatThaiDate(meeting.meetingAt)}
                    {meeting.startTime
                      ? ` · ${meeting.startTime} น.`
                      : ""} · {meeting.createdBy.name}
                  </span>
                </span>
                <ChevronDown
                  size={16}
                  strokeWidth={2}
                  aria-hidden="true"
                  className={cn(
                    "text-muted-foreground shrink-0 transition-transform duration-150",
                    open && "rotate-180",
                  )}
                />
              </button>

              {open ? (
                <div className="px-4 pb-4">
                  <div className="bg-hover rounded-xl p-3">
                    <div className="mb-2 flex items-center gap-2">
                      <Avatar user={meeting.createdBy} size={22} />
                      <span className="text-[11px] font-bold">
                        {meeting.createdBy.name}
                      </span>
                      <span className="text-muted-foreground text-[11px]">
                        บันทึกเมื่อ {formatThaiDate(meeting.meetingAt)}
                      </span>
                    </div>
                    {meeting.description ? (
                      <div className="mb-3">
                        <p className="text-muted-foreground mb-1 text-[11px] font-bold">
                          รายละเอียด / วาระ
                        </p>
                        <p className="text-[13px] leading-relaxed whitespace-pre-wrap">
                          {meeting.description}
                        </p>
                      </div>
                    ) : null}

                    <p className="text-muted-foreground mb-1 text-[11px] font-bold">
                      สรุปผลการประชุม
                    </p>
                    {meeting.summary ? (
                      <p className="text-[13px] leading-relaxed whitespace-pre-wrap">
                        {meeting.summary}
                      </p>
                    ) : (
                      <p className="text-muted-foreground text-[13px]">
                        ยังไม่ได้บันทึกสรุปผล
                      </p>
                    )}
                  </div>

                  {canManage ? (
                    <div className="mt-2 flex justify-end gap-2">
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => onEdit(meeting)}
                        disabled={pending}
                      >
                        <Pencil size={14} strokeWidth={2} />
                        แก้ไข
                      </Button>

                      {confirming === meeting.id ? (
                        <>
                          <Button
                            type="button"
                            variant="destructive"
                            size="sm"
                            onClick={() => remove(meeting.id)}
                            disabled={pending}
                          >
                            ยืนยันลบ
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => setConfirming(null)}
                          >
                            ยกเลิก
                          </Button>
                        </>
                      ) : (
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          onClick={() => setConfirming(meeting.id)}
                          disabled={pending}
                        >
                          <Trash2 size={14} strokeWidth={2} />
                          ลบ
                        </Button>
                      )}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
