"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { NotebookPen, Plus } from "lucide-react";
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
import { MeetingHistory, type MeetingView } from "./meeting-history";

const labelClass = "text-muted-foreground text-xs font-semibold";
const fieldClass = "bg-input-bg h-11 rounded-xl";

/** Recording form on the left, the history it feeds on the right. */
export function MeetingBoard({
  meetings,
  canManage,
  today,
}: {
  meetings: MeetingView[];
  canManage: boolean;
  today: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState<MeetingView | null>(null);

  const form = useForm<MeetingFormValues, unknown, MeetingFormInput>({
    resolver: zodResolver(meetingFormSchema),
    defaultValues: { title: "", meetingAt: today, summary: "" },
  });

  useEffect(() => {
    form.reset(
      editing
        ? {
            title: editing.title,
            meetingAt: editing.meetingAt,
            summary: editing.summary,
          }
        : { title: "", meetingAt: today, summary: "" },
    );
    // form is stable; resetting when the edit target changes is the intent.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing, today]);

  const onSubmit = form.handleSubmit((values) => {
    startTransition(async () => {
      const result = editing
        ? await updateMeetingAction({ id: editing.id, data: values })
        : await createMeetingAction(values);

      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      toast.success(editing ? "แก้ไขรายการประชุมแล้ว" : "บันทึกการประชุมแล้ว");
      setEditing(null);
      form.reset({ title: "", meetingAt: today, summary: "" });
      router.refresh();
    });
  });

  const errors = form.formState.errors;

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
      {canManage ? (
        <form
          onSubmit={onSubmit}
          className="border-line bg-surface flex flex-col gap-4 rounded-[18px] border p-5 shadow-sm"
        >
          <h2 className="text-[15.5px] font-bold">
            {editing ? "แก้ไขรายการประชุม" : "บันทึกการประชุมใหม่"}
          </h2>

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

          <div className="flex flex-col gap-2">
            <Label htmlFor="meetingAt" className={labelClass}>
              วันที่ประชุม
            </Label>
            <Input
              id="meetingAt"
              type="date"
              className={`${fieldClass} sm:max-w-[220px]`}
              {...form.register("meetingAt")}
            />
            {errors.meetingAt ? (
              <p className="text-danger-ink text-xs">
                {errors.meetingAt.message}
              </p>
            ) : null}
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="summary" className={labelClass}>
              สรุปผลการประชุม
            </Label>
            <Textarea
              id="summary"
              rows={10}
              className="bg-input-bg rounded-xl"
              placeholder={"หัวข้อที่คุยกัน ข้อสรุป และสิ่งที่ต้องทำต่อ"}
              {...form.register("summary")}
            />
            {errors.summary ? (
              <p className="text-danger-ink text-xs">
                {errors.summary.message}
              </p>
            ) : null}
          </div>

          <div className="flex justify-end gap-2">
            {editing ? (
              <Button
                type="button"
                variant="ghost"
                onClick={() => setEditing(null)}
                disabled={pending}
              >
                ยกเลิกการแก้ไข
              </Button>
            ) : null}
            <Button type="submit" disabled={pending}>
              {editing ? (
                <>
                  <NotebookPen size={16} strokeWidth={2} />
                  {pending ? "กำลังบันทึก" : "บันทึกการแก้ไข"}
                </>
              ) : (
                <>
                  <Plus size={16} strokeWidth={2} />
                  {pending ? "กำลังบันทึก" : "บันทึกการประชุม"}
                </>
              )}
            </Button>
          </div>
        </form>
      ) : (
        <div className="border-line bg-surface rounded-[18px] border p-5 shadow-sm">
          <h2 className="mb-2 text-[15.5px] font-bold">สรุปผลการประชุม</h2>
          <p className="text-muted-foreground text-sm">
            เลือกการประชุมจากรายการทางขวาเพื่อดูสรุปผล
          </p>
        </div>
      )}

      <MeetingHistory
        meetings={meetings}
        canManage={canManage}
        onEdit={setEditing}
      />
    </div>
  );
}
