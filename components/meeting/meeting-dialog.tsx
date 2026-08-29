"use client";

import { useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { CalendarPlus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  meetingFormSchema,
  type MeetingFormInput,
  type MeetingFormValues,
} from "@/lib/validators/meeting";
import {
  createMeetingAction,
  updateMeetingAction,
} from "@/server/actions/meeting";
import type { MeetingView } from "./meeting-history";

const labelClass = "text-muted-foreground text-xs font-semibold";
const fieldClass = "bg-input-bg h-11 rounded-xl";

export type MeetingDialogState =
  | { mode: "closed" }
  | { mode: "create" }
  | { mode: "edit"; meeting: MeetingView };

/** Books a meeting, and later carries the write-up for one that has happened. */
export function MeetingDialog({
  state,
  onClose,
  today,
}: {
  state: MeetingDialogState;
  onClose: () => void;
  today: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const open = state.mode !== "closed";
  const editing = state.mode === "edit" ? state.meeting : null;

  const form = useForm<MeetingFormValues, unknown, MeetingFormInput>({
    resolver: zodResolver(meetingFormSchema),
    defaultValues: {
      title: "",
      meetingAt: today,
      startTime: "",
      description: "",
      summary: "",
    },
  });

  useEffect(() => {
    if (state.mode === "edit") {
      const m = state.meeting;
      form.reset({
        title: m.title,
        meetingAt: m.meetingAt,
        startTime: m.startTime ?? "",
        description: m.description ?? "",
        summary: m.summary ?? "",
      });
    } else if (state.mode === "create") {
      form.reset({
        title: "",
        meetingAt: today,
        startTime: "",
        description: "",
        summary: "",
      });
    }
    // form is stable; refilling when the target changes is the intent.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, today]);

  const onSubmit = form.handleSubmit((values) => {
    startTransition(async () => {
      const result = editing
        ? await updateMeetingAction({ id: editing.id, data: values })
        : await createMeetingAction(values);

      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      toast.success(editing ? "บันทึกการแก้ไขแล้ว" : "นัดประชุมแล้ว");
      onClose();
      router.refresh();
    });
  });

  const errors = form.formState.errors;

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle>
            {editing ? "แก้ไขการประชุม" : "นัดประชุมใหม่"}
          </DialogTitle>
          <DialogDescription>
            กำหนดวันเวลาและหัวข้อ แล้วการประชุมจะไปแสดงบนปฏิทินทีม
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="title" className={labelClass}>
              หัวข้อการประชุม
            </Label>
            <Input
              id="title"
              className={fieldClass}
              placeholder="เช่น ประชุมวางแผนสปรินต์"
              {...form.register("title")}
            />
            {errors.title ? (
              <p className="text-danger-ink text-xs">{errors.title.message}</p>
            ) : null}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="meetingAt" className={labelClass}>
                วันที่ประชุม
              </Label>
              <Input
                id="meetingAt"
                type="date"
                className={fieldClass}
                {...form.register("meetingAt")}
              />
              {errors.meetingAt ? (
                <p className="text-danger-ink text-xs">
                  {errors.meetingAt.message}
                </p>
              ) : null}
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="startTime" className={labelClass}>
                เวลา
              </Label>
              <Input
                id="startTime"
                type="time"
                className={fieldClass}
                {...form.register("startTime")}
              />
              {errors.startTime ? (
                <p className="text-danger-ink text-xs">
                  {errors.startTime.message}
                </p>
              ) : null}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="description" className={labelClass}>
              รายละเอียด / วาระการประชุม
            </Label>
            <Textarea
              id="description"
              rows={4}
              className="bg-input-bg rounded-xl"
              placeholder="หัวข้อที่จะคุย สถานที่ หรือลิงก์ห้องประชุม"
              {...form.register("description")}
            />
            {errors.description ? (
              <p className="text-danger-ink text-xs">
                {errors.description.message}
              </p>
            ) : null}
          </div>

          <div className="border-line flex flex-col gap-2 border-t pt-4">
            <Label htmlFor="summary" className={labelClass}>
              สรุปผลการประชุม
              <span className="ml-1 font-normal">(กรอกหลังประชุมเสร็จ)</span>
            </Label>
            <Textarea
              id="summary"
              rows={6}
              className="bg-input-bg rounded-xl"
              placeholder="ข้อสรุปและสิ่งที่ต้องทำต่อ"
              {...form.register("summary")}
            />
            {errors.summary ? (
              <p className="text-danger-ink text-xs">
                {errors.summary.message}
              </p>
            ) : null}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={onClose}
              disabled={pending}
            >
              ยกเลิก
            </Button>
            <Button type="submit" disabled={pending}>
              <CalendarPlus size={16} strokeWidth={2} />
              {pending
                ? "กำลังบันทึก"
                : editing
                  ? "บันทึกการแก้ไข"
                  : "นัดประชุม"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
