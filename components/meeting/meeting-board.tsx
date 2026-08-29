"use client";

import { useState } from "react";
import { CalendarClock, CalendarPlus, NotebookPen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/empty-state";
import { formatThaiDate } from "@/lib/format";
import { MeetingHistory, type MeetingView } from "./meeting-history";
import { MeetingDialog, type MeetingDialogState } from "./meeting-dialog";

/** Upcoming meetings on the left, the full history on the right. */
export function MeetingBoard({
  meetings,
  canManage,
  today,
}: {
  meetings: MeetingView[];
  canManage: boolean;
  today: string;
}) {
  const [dialog, setDialog] = useState<MeetingDialogState>({ mode: "closed" });

  // Meetings are handed over newest first; upcoming reads better the other way.
  const upcoming = meetings
    .filter((meeting) => meeting.meetingAt >= today)
    .slice()
    .reverse();

  return (
    <>
      {canManage ? (
        <div className="mb-4 flex justify-end">
          <Button type="button" onClick={() => setDialog({ mode: "create" })}>
            <CalendarPlus size={16} strokeWidth={2} />
            นัดประชุม
          </Button>
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
        <section className="border-line bg-surface rounded-[18px] border p-5 shadow-sm">
          <h2 className="mb-4 text-[15.5px] font-bold">
            การประชุมที่จะถึง
            {upcoming.length > 0 ? (
              <span className="text-muted-foreground ml-2 text-xs font-semibold">
                {upcoming.length} รายการ
              </span>
            ) : null}
          </h2>

          {upcoming.length === 0 ? (
            <EmptyState
              icon={CalendarClock}
              message={
                canManage
                  ? "ยังไม่มีนัดประชุม กดปุ่มนัดประชุมเพื่อเพิ่ม"
                  : "ยังไม่มีนัดประชุมที่จะถึง"
              }
            />
          ) : (
            <ul className="flex flex-col gap-3">
              {upcoming.map((meeting) => (
                <li
                  key={meeting.id}
                  className="bg-hover rounded-xl p-4"
                  style={{ borderLeft: "3px solid var(--color-primary)" }}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-bold">{meeting.title}</span>
                    <span className="text-primary-ink text-xs font-semibold">
                      {formatThaiDate(meeting.meetingAt)}
                      {meeting.startTime ? ` · ${meeting.startTime} น.` : ""}
                    </span>
                    {canManage ? (
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        className="ml-auto"
                        onClick={() => setDialog({ mode: "edit", meeting })}
                      >
                        <NotebookPen size={14} strokeWidth={2} />
                        แก้ไข
                      </Button>
                    ) : null}
                  </div>
                  {meeting.description ? (
                    <p className="text-muted-foreground mt-2 text-[13px] leading-relaxed whitespace-pre-wrap">
                      {meeting.description}
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </section>

        <MeetingHistory
          meetings={meetings}
          canManage={canManage}
          onEdit={(meeting) => setDialog({ mode: "edit", meeting })}
        />
      </div>

      <MeetingDialog
        state={dialog}
        today={today}
        onClose={() => setDialog({ mode: "closed" })}
      />
    </>
  );
}
