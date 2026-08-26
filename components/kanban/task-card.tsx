"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  CalendarDays,
  GripVertical,
  MessageSquare,
  TriangleAlert,
} from "lucide-react";
import { PriorityBadge } from "@/components/shared/badges";
import { Avatar } from "@/components/shared/avatar";
import { formatThaiDate, isOverdue } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { BoardTaskView } from "./types";

export function TaskCardBody({
  task,
  today,
}: {
  task: BoardTaskView;
  today: string;
}) {
  const overdue = isOverdue(task.dueDate, task.status, today);

  return (
    <>
      <PriorityBadge priority={task.priority} />
      <h3 className="mt-2 text-sm leading-snug font-bold">{task.title}</h3>
      {task.description ? (
        <p className="text-muted-foreground mt-1 line-clamp-2 text-xs leading-relaxed">
          {task.description}
        </p>
      ) : null}

      <div className="mt-3 flex items-center justify-between gap-2">
        <span
          className={cn(
            "inline-flex items-center gap-1.5 text-[11px]",
            overdue
              ? "text-danger-ink font-bold"
              : "text-muted-foreground font-medium",
          )}
        >
          {overdue ? (
            <TriangleAlert size={13} strokeWidth={2} />
          ) : (
            <CalendarDays size={13} strokeWidth={2} />
          )}
          {task.dueDate ? formatThaiDate(task.dueDate) : "ไม่มีเดดไลน์"}
          {overdue ? " · เลยกำหนด" : ""}
        </span>
        {task.assignee ? <Avatar user={task.assignee} size={24} /> : null}
      </div>

      {task.progressCount > 0 ? (
        <p className="text-muted-foreground mt-2 inline-flex items-center gap-1.5 text-[11px]">
          <MessageSquare size={12} strokeWidth={2} />
          {task.progressCount} อัพเดท
        </p>
      ) : null}
    </>
  );
}

/**
 * Draggable card.
 *
 * Two separate controls, because one control cannot both open the dialog and
 * start a drag on the same key: the body button opens the task, the handle
 * moves it. Pointer drags go through dnd-kit; keyboard moves are handled here
 * with the arrow keys, which is deterministic across columns where dnd-kit's
 * keyboard coordinate getter is not (SPEC 5.3).
 */
export function TaskCard({
  task,
  today,
  onOpen,
  onMove,
}: {
  task: BoardTaskView;
  today: string;
  onOpen: (task: BoardTaskView) => void;
  onMove: (
    task: BoardTaskView,
    direction: "left" | "right" | "up" | "down",
  ) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id, data: { status: task.status } });

  return (
    <article
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn(
        "border-line bg-surface group relative mb-3 rounded-2xl border p-4 shadow-sm",
        "transition-[box-shadow,transform] duration-150",
        "hover:shadow-lift hover:-translate-y-0.5",
        isDragging && "opacity-40",
      )}
    >
      <button
        type="button"
        ref={setActivatorNodeRef}
        aria-label={`ย้ายงาน ${task.title} — ลากด้วยเมาส์ หรือกดปุ่มลูกศรเพื่อย้าย`}
        title="ลากเพื่อย้าย หรือกดลูกศรเมื่อโฟกัส"
        className="text-muted-foreground hover:bg-hover hover:text-ink absolute top-3 right-2 inline-flex size-7 cursor-grab items-center justify-center rounded-lg transition-colors duration-150 active:cursor-grabbing"
        {...attributes}
        {...listeners}
        onKeyDown={(event) => {
          const directions = {
            ArrowLeft: "left",
            ArrowRight: "right",
            ArrowUp: "up",
            ArrowDown: "down",
          } as const;
          const direction = directions[event.key as keyof typeof directions];
          if (!direction) return;
          event.preventDefault();
          event.stopPropagation();
          onMove(task, direction);
        }}
      >
        <GripVertical size={15} strokeWidth={2} />
      </button>

      <button
        type="button"
        className="w-full pr-7 text-left"
        onClick={() => onOpen(task)}
        aria-label={`เปิดงาน ${task.title}`}
      >
        <TaskCardBody task={task} today={today} />
      </button>
    </article>
  );
}
