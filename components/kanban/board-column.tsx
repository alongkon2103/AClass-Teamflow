"use client";

import { useDroppable } from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { Plus, Columns3 } from "lucide-react";
import type { TaskStatus } from "@prisma/client";
import { TASK_STATUS_META } from "@/lib/constants";
import { EmptyState } from "@/components/shared/empty-state";
import { TaskCard } from "./task-card";
import type { BoardTaskView } from "./types";

export function BoardColumn({
  status,
  tasks,
  today,
  onOpenTask,
  onAddTask,
  onMoveTask,
}: {
  status: TaskStatus;
  tasks: BoardTaskView[];
  today: string;
  onOpenTask: (task: BoardTaskView) => void;
  onAddTask: (status: TaskStatus) => void;
  onMoveTask: (
    task: BoardTaskView,
    direction: "left" | "right" | "up" | "down",
  ) => void;
}) {
  const meta = TASK_STATUS_META[status];
  // Droppable id is the column itself, so an empty column still accepts a drop.
  const { setNodeRef, isOver } = useDroppable({
    id: `column:${status}`,
    data: { status },
  });

  return (
    <section className="min-w-[240px] flex-1" aria-label={meta.label}>
      <div className="flex items-center gap-2 px-1 pb-3">
        <span
          aria-hidden="true"
          className="size-2 rounded-full"
          style={{ background: meta.mark }}
        />
        <span className="text-sm font-bold">{meta.label}</span>
        <span className="text-muted-foreground text-xs font-semibold">
          {tasks.length} งาน
        </span>
        <button
          type="button"
          onClick={() => onAddTask(status)}
          aria-label={`เพิ่มงานใน${meta.label}`}
          title={`เพิ่มงานใน${meta.label}`}
          className="text-muted-foreground hover:bg-hover hover:text-ink ml-auto inline-flex size-7 items-center justify-center rounded-lg transition-colors duration-150"
        >
          <Plus size={15} strokeWidth={2} />
        </button>
      </div>

      <div
        ref={setNodeRef}
        className="min-h-32 rounded-2xl pt-3 transition-colors duration-150"
        style={{
          borderTop: `3px solid ${meta.mark}`,
          background: isOver ? "var(--primary-soft)" : undefined,
        }}
      >
        <SortableContext
          items={tasks.map((task) => task.id)}
          strategy={verticalListSortingStrategy}
        >
          {tasks.length === 0 ? (
            <div className="border-line rounded-2xl border border-dashed">
              <EmptyState
                icon={Columns3}
                message={`ยังไม่มีงานใน "${meta.label}"`}
              />
            </div>
          ) : (
            tasks.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                today={today}
                onOpen={onOpenTask}
                onMove={onMoveTask}
              />
            ))
          )}
        </SortableContext>
      </div>
    </section>
  );
}
