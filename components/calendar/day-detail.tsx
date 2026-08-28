"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { CalendarDays, MessageSquare, Umbrella } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Avatar } from "@/components/shared/avatar";
import { Skeleton } from "@/components/shared/skeleton";
import { formatThaiDate } from "@/lib/format";
import {
  ImageLightbox,
  type LightboxState,
} from "@/components/kanban/image-lightbox";
import { loadDayDetailAction } from "@/server/actions/leave";

type Detail = Awaited<ReturnType<typeof loadDayDetailAction>>;

export function DayDetailDialog({
  day,
  onClose,
}: {
  day: string | null;
  onClose: () => void;
}) {
  const [detail, setDetail] = useState<Detail | null>(null);
  const [lightbox, setLightbox] = useState<LightboxState>(null);

  useEffect(() => {
    if (!day) {
      setDetail(null);
      return;
    }
    let cancelled = false;
    setDetail(null);
    loadDayDetailAction(day).then((data) => {
      if (!cancelled) setDetail(data);
    });
    return () => {
      cancelled = true;
    };
  }, [day]);

  const empty =
    detail !== null &&
    detail.leaves.length === 0 &&
    detail.progress.length === 0 &&
    detail.dueTasks.length === 0;

  return (
    <Dialog open={day !== null} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>{day ? formatThaiDate(day) : ""}</DialogTitle>
          <DialogDescription>
            การลา งานที่ครบกำหนด และความคืบหน้าของวันนี้
          </DialogDescription>
        </DialogHeader>

        {detail === null ? (
          <div className="flex flex-col gap-2">
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
          </div>
        ) : empty ? (
          <p className="text-muted-foreground py-6 text-center text-sm">
            วันนี้ไม่มีรายการ
          </p>
        ) : (
          <div className="flex flex-col gap-5">
            {detail.leaves.length > 0 ? (
              <section>
                <h3
                  className="mb-2 inline-flex items-center gap-1.5 text-[13px] font-bold"
                  style={{ color: "var(--color-leave-ink)" }}
                >
                  <Umbrella size={15} strokeWidth={2} />
                  การลางาน
                </h3>
                <ul className="flex flex-col gap-2">
                  {detail.leaves.map((leave) => (
                    <li
                      key={leave.id}
                      className="flex items-center gap-2.5 rounded-xl p-2.5"
                      style={{
                        background:
                          "color-mix(in srgb, var(--color-leave) 14%, transparent)",
                      }}
                    >
                      <Avatar user={leave} size={30} />
                      <div className="min-w-0">
                        <p className="text-[13px] font-bold">{leave.name}</p>
                        {leave.reason ? (
                          <p className="text-muted-foreground text-xs">
                            {leave.reason}
                          </p>
                        ) : null}
                      </div>
                      <span
                        className="ml-auto text-[11px] font-bold"
                        style={{ color: "var(--color-leave-ink)" }}
                      >
                        {leave.status === "PENDING" ? "รออนุมัติ · " : ""}
                        {leave.startDate === leave.endDate
                          ? "ลา 1 วัน"
                          : `${formatThaiDate(leave.startDate)} – ${formatThaiDate(leave.endDate)}`}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            {detail.dueTasks.length > 0 ? (
              <section>
                <h3 className="text-danger-ink mb-2 inline-flex items-center gap-1.5 text-[13px] font-bold">
                  <CalendarDays size={15} strokeWidth={2} />
                  ครบกำหนดส่งวันนี้
                </h3>
                <ul className="flex flex-col gap-2">
                  {detail.dueTasks.map((task) => (
                    <li
                      key={task.id}
                      className="rounded-xl px-3 py-2 text-[13px]"
                      style={{
                        background:
                          "color-mix(in srgb, var(--color-danger) 12%, transparent)",
                      }}
                    >
                      {task.title}
                      {task.assignees.length > 0 ? (
                        <span className="text-muted-foreground text-xs">
                          {" "}
                          · {task.assignees.map((a) => a.name).join(", ")}
                        </span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            {detail.progress.length > 0 ? (
              <section>
                <h3 className="text-primary-ink mb-2 inline-flex items-center gap-1.5 text-[13px] font-bold">
                  <MessageSquare size={15} strokeWidth={2} />
                  ความคืบหน้าที่ส่งวันนี้
                </h3>
                <ul className="flex flex-col gap-2">
                  {detail.progress.map((entry) => (
                    <li key={entry.id} className="bg-hover rounded-xl p-3">
                      <div className="flex items-center gap-2">
                        <Avatar user={entry.author} size={24} />
                        <span className="text-xs font-bold">
                          {entry.author.name}
                        </span>
                        <span className="text-muted-foreground truncate text-[11px]">
                          · {entry.taskTitle}
                        </span>
                      </div>
                      <p className="mt-1.5 text-[13px] leading-relaxed whitespace-pre-wrap">
                        {entry.body}
                      </p>
                      {entry.imageUrls.length > 0 ? (
                        <ul className="mt-2 flex flex-wrap gap-2">
                          {entry.imageUrls.map((url, position) => (
                            <li key={url}>
                              <button
                                type="button"
                                onClick={() =>
                                  setLightbox({
                                    images: entry.imageUrls,
                                    index: position,
                                  })
                                }
                                aria-label={`ดูรูปที่ ${position + 1} ขนาดเต็ม`}
                                className="block cursor-zoom-in"
                              >
                                <Image
                                  src={url}
                                  alt=""
                                  width={140}
                                  height={140}
                                  unoptimized
                                  className="border-line size-20 rounded-lg border object-cover"
                                />
                              </button>
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
          </div>
        )}

        <ImageLightbox state={lightbox} onClose={() => setLightbox(null)} />
      </DialogContent>
    </Dialog>
  );
}
