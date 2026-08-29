"use client";

import { useEffect, useTransition } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { TaskStatus, Priority } from "@prisma/client";
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
  taskFormSchema,
  type TaskFormInput,
  type TaskFormValues,
} from "@/lib/validators/task";
import {
  TASK_STATUS_META,
  TASK_STATUS_ORDER,
  PRIORITY_META,
} from "@/lib/constants";
import {
  createTaskAction,
  updateTaskAction,
  deleteTaskAction,
} from "@/server/actions/task";
import { AssigneePicker } from "./assignee-picker";
import { ProgressSection } from "./progress-section";
import type { BoardTaskView, MemberOption, GameOption } from "./types";

const PRIORITY_ORDER: Priority[] = [
  Priority.NORMAL,
  Priority.IMPORTANT,
  Priority.URGENT,
];

const labelClass = "text-muted-foreground text-xs font-semibold";
const fieldClass = "bg-input-bg h-11 rounded-xl";
/** Native select keeps the form keyboard-simple and avoids a portal inside the dialog. */
const selectClass =
  "bg-input-bg border-line text-ink h-11 w-full rounded-xl border px-3 text-sm";

export type TaskDialogState =
  | { mode: "closed" }
  | { mode: "create"; status: TaskStatus; assigneeId: string | null }
  | { mode: "edit"; task: BoardTaskView };

export function TaskDialog({
  state,
  onClose,
  members,
  games,
  canAssign,
  today,
  onSaved,
}: {
  state: TaskDialogState;
  onClose: () => void;
  members: MemberOption[];
  games: GameOption[];
  canAssign: boolean;
  today: string;
  /** Lets the board refresh its progress counts after an entry is added. */
  onSaved: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const open = state.mode !== "closed";
  const editing = state.mode === "edit" ? state.task : null;

  // <values, context, transformed> — handleSubmit receives the parsed output.
  const form = useForm<TaskFormValues, unknown, TaskFormInput>({
    resolver: zodResolver(taskFormSchema),
    defaultValues: {
      title: "",
      description: "",
      status: TaskStatus.TODO,
      priority: Priority.NORMAL,
      startDate: today,
      dueDate: null,
      assigneeIds: [],
      gameId: null,
      gameNote: null,
    },
  });

  // Refill whenever the dialog opens for a different task.
  useEffect(() => {
    if (state.mode === "edit") {
      const t = state.task;
      form.reset({
        title: t.title,
        description: t.description ?? "",
        status: t.status,
        priority: t.priority,
        startDate: t.startDate,
        dueDate: t.dueDate,
        assigneeIds: t.assigneeIds,
        gameId: t.gameId,
        gameNote: t.gameNote,
      });
    } else if (state.mode === "create") {
      form.reset({
        title: "",
        description: "",
        status: state.status,
        priority: Priority.NORMAL,
        startDate: today,
        dueDate: null,
        assigneeIds: state.assigneeId ? [state.assigneeId] : [],
        gameId: null,
        gameNote: null,
      });
    }
    // form is stable across renders; resetting on state change is the intent.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, today]);

  const onSubmit = form.handleSubmit((values) => {
    startTransition(async () => {
      const result = editing
        ? await updateTaskAction({ id: editing.id, data: values })
        : await createTaskAction(values);

      if (result.ok) {
        toast.success(editing ? "บันทึกงานแล้ว" : "สร้างงานใหม่แล้ว");
        onClose();
      } else {
        toast.error(result.message);
      }
    });
  });

  const onDelete = () => {
    if (!editing) return;
    startTransition(async () => {
      const result = await deleteTaskAction({ id: editing.id });
      if (result.ok) {
        toast.success("ลบงานแล้ว");
        onClose();
      } else {
        toast.error(result.message);
      }
    });
  };

  const errors = form.formState.errors;
  // Watched so the free-text game field appears the moment "ไม่ระบุ" is picked.
  const gameId = form.watch("gameId");

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>
            {editing ? "รายละเอียดงาน" : "เพิ่มงานใหม่"}
          </DialogTitle>
          <DialogDescription>
            {editing
              ? "แก้ไขข้อมูลงานและบันทึกเมื่อเสร็จ"
              : "กรอกข้อมูลงานที่ต้องการเพิ่มลงบอร์ด"}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="title" className={labelClass}>
              ชื่องาน
            </Label>
            <Input
              id="title"
              className={fieldClass}
              {...form.register("title")}
            />
            {errors.title ? (
              <p className="text-danger-ink text-xs">{errors.title.message}</p>
            ) : null}
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="description" className={labelClass}>
              รายละเอียด
            </Label>
            <Textarea
              id="description"
              rows={3}
              className="bg-input-bg rounded-xl"
              {...form.register("description")}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="startDate" className={labelClass}>
                วันที่เริ่มงาน
              </Label>
              <Input
                id="startDate"
                type="date"
                className={fieldClass}
                {...form.register("startDate")}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="dueDate" className={labelClass}>
                เดดไลน์
              </Label>
              <Input
                id="dueDate"
                type="date"
                className={fieldClass}
                {...form.register("dueDate")}
              />
              {errors.dueDate ? (
                <p className="text-danger-ink text-xs">
                  {errors.dueDate.message}
                </p>
              ) : null}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="status" className={labelClass}>
                สถานะ
              </Label>
              <select
                id="status"
                className={selectClass}
                {...form.register("status")}
              >
                {TASK_STATUS_ORDER.map((s) => (
                  <option key={s} value={s}>
                    {TASK_STATUS_META[s].label}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="priority" className={labelClass}>
                ความสำคัญ
              </Label>
              <select
                id="priority"
                className={selectClass}
                {...form.register("priority")}
              >
                {PRIORITY_ORDER.map((p) => (
                  <option key={p} value={p}>
                    {PRIORITY_META[p].label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {canAssign ? (
            <Controller
              control={form.control}
              name="assigneeIds"
              render={({ field }) => (
                <AssigneePicker
                  members={members}
                  value={field.value ?? []}
                  onChange={field.onChange}
                />
              )}
            />
          ) : null}

          <div className="flex flex-col gap-2">
            <Label htmlFor="gameId" className={labelClass}>
              เกมที่เกี่ยวข้อง
            </Label>
            <select
              id="gameId"
              className={selectClass}
              {...form.register("gameId")}
            >
              <option value="">ไม่ระบุ</option>
              {games.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>

            {/* No library game chosen: let the user name it themselves. */}
            {!gameId ? (
              <Input
                aria-label="ชื่อเกมหรือหมายเหตุ"
                placeholder="ระบุชื่อเกมเองได้ (ถ้ามี)"
                className={fieldClass}
                {...form.register("gameNote")}
              />
            ) : null}
          </div>

          {editing ? (
            <ProgressSection
              taskId={editing.id}
              today={today}
              onSaved={onSaved}
              canReply={canAssign}
              members={members}
            />
          ) : null}

          <DialogFooter className="gap-2">
            {editing ? (
              <Button
                type="button"
                variant="destructive"
                onClick={onDelete}
                disabled={pending}
                className="mr-auto"
              >
                <Trash2 size={16} strokeWidth={2} />
                ลบงาน
              </Button>
            ) : null}
            <Button
              type="button"
              variant="ghost"
              onClick={onClose}
              disabled={pending}
            >
              ยกเลิก
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "กำลังบันทึก" : "บันทึก"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
