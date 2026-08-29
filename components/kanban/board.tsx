"use client";

import {
  useEffect,
  useMemo,
  useOptimistic,
  useRef,
  useState,
  useTransition,
} from "react";
import { useRouter } from "next/navigation";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { TaskStatus } from "@prisma/client";
import { TASK_STATUS_ORDER } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { useDeepLinkParam } from "@/lib/use-deep-link";
import { moveTaskAction } from "@/server/actions/task";
import { BoardColumn } from "./board-column";
import { TaskCardBody } from "./task-card";
import { TaskDialog, type TaskDialogState } from "./task-dialog";
import type { BoardTaskView, MemberOption, GameOption } from "./types";

type Move = { taskId: string; status: TaskStatus; toIndex: number };

/** Apply a move to the list the same way the server will, for optimistic render. */
function applyMove(tasks: BoardTaskView[], move: Move): BoardTaskView[] {
  const moving = tasks.find((task) => task.id === move.taskId);
  if (!moving) return tasks;

  const rest = tasks.filter((task) => task.id !== move.taskId);
  const column = rest.filter((task) => task.status === move.status);
  const others = rest.filter((task) => task.status !== move.status);

  const index = Math.max(0, Math.min(move.toIndex, column.length));
  const before = column[index - 1]?.sortOrder;
  const after = column[index]?.sortOrder;

  const sortOrder =
    before === undefined && after === undefined
      ? 1000
      : before === undefined
        ? after! - 1000
        : after === undefined
          ? before + 1000
          : (before + after) / 2;

  column.splice(index, 0, { ...moving, status: move.status, sortOrder });
  return [...others, ...column].sort((a, b) => a.sortOrder - b.sortOrder);
}

export function Board({
  initialTasks,
  members,
  games,
  canAssign,
  today,
  defaultAssigneeId,
  boardUserId,
}: {
  initialTasks: BoardTaskView[];
  members: MemberOption[];
  games: GameOption[];
  canAssign: boolean;
  today: string;
  defaultAssigneeId: string | null;
  /** Whose board is on screen, so the server orders against the same list. */
  boardUserId: string | null;
}) {
  const router = useRouter();
  const [dialog, setDialog] = useState<TaskDialogState>({ mode: "closed" });
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  // A notification links to /board?task=<id>; open that task straight away.
  const linkedTaskId = useDeepLinkParam("task");
  const openedLinkRef = useRef<string | null>(null);
  useEffect(() => {
    if (!linkedTaskId || openedLinkRef.current === linkedTaskId) return;
    openedLinkRef.current = linkedTaskId;

    const linked = initialTasks.find((task) => task.id === linkedTaskId);
    if (linked) setDialog({ mode: "edit", task: linked });
    // The board only holds what this user may see, so a miss is a real answer.
    else toast.error("ไม่พบงานนี้ หรือคุณไม่มีสิทธิ์เข้าถึง");
  }, [linkedTaskId, initialTasks]);

  // Optimistic layer: the drop shows instantly and reverts if the server says no.
  const [tasks, applyOptimistic] = useOptimistic(
    initialTasks,
    (state: BoardTaskView[], move: Move) => applyMove(state, move),
  );

  // Pointer only: keyboard moves are handled explicitly on each card's handle,
  // which behaves predictably across columns (see TaskCard).
  const sensors = useSensors(
    // A small distance keeps a plain click from starting a drag.
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  const columns = useMemo(() => {
    const grouped = new Map<TaskStatus, BoardTaskView[]>(
      TASK_STATUS_ORDER.map((status) => [status, []]),
    );
    for (const task of [...tasks].sort((a, b) => a.sortOrder - b.sortOrder)) {
      grouped.get(task.status)?.push(task);
    }
    return grouped;
  }, [tasks]);

  const draggingTask = draggingId
    ? tasks.find((task) => task.id === draggingId)
    : null;

  /** Optimistically apply a move, then persist it; a failure rolls back. */
  const commitMove = (move: Move) => {
    startTransition(async () => {
      applyOptimistic(move);
      const result = await moveTaskAction({ ...move, boardUserId });
      if (!result.ok) {
        // useOptimistic drops the override when the transition ends, so the
        // server state returns on its own; the toast explains why.
        toast.error(result.message);
      }
    });
  };

  /** Arrow-key movement from a card's handle. */
  const onMoveTask = (
    task: BoardTaskView,
    direction: "left" | "right" | "up" | "down",
  ) => {
    const columnIndex = TASK_STATUS_ORDER.indexOf(task.status);
    const columnTasks = columns.get(task.status) ?? [];
    const position = columnTasks.findIndex((item) => item.id === task.id);

    if (direction === "left" || direction === "right") {
      const nextStatus =
        TASK_STATUS_ORDER[columnIndex + (direction === "right" ? 1 : -1)];
      if (!nextStatus) return;
      // Land at the end of the destination column.
      const target = (columns.get(nextStatus) ?? []).length;
      commitMove({ taskId: task.id, status: nextStatus, toIndex: target });
      return;
    }

    const nextPosition = position + (direction === "down" ? 1 : -1);
    if (nextPosition < 0 || nextPosition >= columnTasks.length) return;
    commitMove({
      taskId: task.id,
      status: task.status,
      toIndex: nextPosition,
    });
  };

  const onDragStart = (event: DragStartEvent) =>
    setDraggingId(String(event.active.id));

  const onDragEnd = (event: DragEndEvent) => {
    setDraggingId(null);
    const { active, over } = event;
    if (!over) return;

    const activeId = String(active.id);
    const overId = String(over.id);
    const moving = tasks.find((task) => task.id === activeId);
    if (!moving) return;

    // Dropping on a column header area vs. on another card.
    const overColumn = overId.startsWith("column:")
      ? (overId.slice("column:".length) as TaskStatus)
      : tasks.find((task) => task.id === overId)?.status;
    if (!overColumn) return;

    const columnTasks = (columns.get(overColumn) ?? []).filter(
      (task) => task.id !== activeId,
    );
    const toIndex = overId.startsWith("column:")
      ? columnTasks.length
      : Math.max(
          0,
          columnTasks.findIndex((task) => task.id === overId),
        );

    if (moving.status === overColumn) {
      const currentIndex = (columns.get(overColumn) ?? []).findIndex(
        (task) => task.id === activeId,
      );
      if (currentIndex === toIndex) return;
    }

    commitMove({ taskId: activeId, status: overColumn, toIndex });
  };

  return (
    <>
      <div className="mb-4 flex justify-end">
        <Button
          onClick={() =>
            setDialog({
              mode: "create",
              status: TaskStatus.TODO,
              assigneeId: defaultAssigneeId,
            })
          }
        >
          <Plus size={16} strokeWidth={2} />
          เพิ่มงาน
        </Button>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        onDragCancel={() => setDraggingId(null)}
        accessibility={{
          announcements: {
            onDragStart: ({ active }) => `เริ่มลากงาน ${active.id}`,
            onDragOver: () => "กำลังลาก",
            onDragEnd: () => "วางงานแล้ว",
            onDragCancel: () => "ยกเลิกการลาก",
          },
        }}
      >
        <div className="flex gap-4 overflow-x-auto pb-2">
          {TASK_STATUS_ORDER.map((status) => (
            <BoardColumn
              key={status}
              status={status}
              tasks={columns.get(status) ?? []}
              today={today}
              onOpenTask={(task) => setDialog({ mode: "edit", task })}
              onMoveTask={onMoveTask}
              onAddTask={(columnStatus) =>
                setDialog({
                  mode: "create",
                  status: columnStatus,
                  assigneeId: defaultAssigneeId,
                })
              }
            />
          ))}
        </div>

        <DragOverlay>
          {draggingTask ? (
            <div className="border-line bg-surface shadow-lift rounded-2xl border p-4">
              <TaskCardBody task={draggingTask} today={today} />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      <TaskDialog
        state={dialog}
        onClose={() => setDialog({ mode: "closed" })}
        members={members}
        games={games}
        canAssign={canAssign}
        today={today}
        onSaved={() => router.refresh()}
      />
    </>
  );
}
