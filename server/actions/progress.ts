"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireActor } from "@/lib/auth";
import { ForbiddenError } from "@/lib/permissions";
import {
  createProgressSchema,
  deleteProgressSchema,
} from "@/lib/validators/progress";
import { createProgress, deleteProgress } from "@/server/services/progress";
import { NotFoundError } from "@/server/services/task";
import type { ActionResult } from "./task";

async function run<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (error) {
    if (error instanceof ForbiddenError || error instanceof NotFoundError) {
      return { ok: false, message: error.message };
    }
    console.error("[progress action]", error);
    return { ok: false, message: "บันทึกไม่สำเร็จ กรุณาลองใหม่อีกครั้ง" };
  }
}

function refresh() {
  revalidatePath("/board");
  revalidatePath("/calendar");
  revalidatePath("/dashboard");
}

export async function createProgressAction(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  return run(async () => {
    const actor = await requireActor();
    const parsed = createProgressSchema.safeParse(input);
    if (!parsed.success) {
      throw new ForbiddenError(
        parsed.error.issues[0]?.message ?? "ข้อมูลไม่ถูกต้อง",
      );
    }
    const entry = await createProgress(db, actor, parsed.data);
    refresh();
    return { id: entry.id };
  });
}

export async function deleteProgressAction(
  input: unknown,
): Promise<ActionResult> {
  return run(async () => {
    const actor = await requireActor();
    const parsed = deleteProgressSchema.safeParse(input);
    if (!parsed.success) throw new NotFoundError();
    await deleteProgress(db, actor, parsed.data.id);
    refresh();
    return undefined;
  });
}

/** Timeline for one task, used when the dialog opens. */
export async function loadProgressAction(taskId: string) {
  const actor = await requireActor();
  const task = await db.task.findFirst({
    where: { id: taskId, archivedAt: null },
    select: { id: true, assigneeId: true },
  });
  if (!task) return [];

  // Reuse the view rule: a member may only read progress on their own task.
  if (actor.role !== "LEADER" && task.assigneeId !== actor.id) return [];

  const { listProgressForTask } = await import("@/server/services/progress");
  const entries = await listProgressForTask(db, taskId);
  const { formatCalendarDate } = await import("@/lib/date");

  return entries.map((entry) => ({
    id: entry.id,
    entryDate: formatCalendarDate(entry.entryDate),
    body: entry.body,
    imageUrl: entry.imageUrl,
    authorId: entry.authorId,
    author: entry.author,
    canDelete: actor.role === "LEADER" || entry.authorId === actor.id,
  }));
}
