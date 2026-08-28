"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireActor } from "@/lib/auth";
import { ForbiddenError } from "@/lib/permissions";
import {
  createProgressSchema,
  deleteProgressSchema,
  replyProgressSchema,
  deleteProgressCommentSchema,
} from "@/lib/validators/progress";
import {
  createProgress,
  deleteProgress,
  replyToProgress,
  deleteProgressComment,
} from "@/server/services/progress";
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

export async function replyProgressAction(
  input: unknown,
): Promise<ActionResult> {
  return run(async () => {
    const actor = await requireActor();
    const parsed = replyProgressSchema.safeParse(input);
    if (!parsed.success) {
      throw new ForbiddenError(
        parsed.error.issues[0]?.message ?? "ข้อมูลไม่ถูกต้อง",
      );
    }
    await replyToProgress(db, actor, parsed.data.entryId, parsed.data.body);
    refresh();
    return undefined;
  });
}

export async function deleteProgressCommentAction(
  input: unknown,
): Promise<ActionResult> {
  return run(async () => {
    const actor = await requireActor();
    const parsed = deleteProgressCommentSchema.safeParse(input);
    if (!parsed.success) throw new NotFoundError();
    await deleteProgressComment(db, actor, parsed.data.id);
    refresh();
    return undefined;
  });
}

/** Timeline for one task, used when the dialog opens. */
export async function loadProgressAction(taskId: string) {
  const actor = await requireActor();
  const task = await db.task.findFirst({
    where: { id: taskId, archivedAt: null },
    select: { id: true, assignees: { select: { userId: true } } },
  });
  if (!task) return [];

  // Reuse the view rule: a member may only read progress on a task they are on.
  const assigneeIds = task.assignees.map((row) => row.userId);
  if (actor.role !== "LEADER" && !assigneeIds.includes(actor.id)) return [];

  const { listProgressForTask } = await import("@/server/services/progress");
  const entries = await listProgressForTask(db, taskId);
  const { formatCalendarDate } = await import("@/lib/date");

  return entries.map((entry) => ({
    id: entry.id,
    entryDate: formatCalendarDate(entry.entryDate),
    body: entry.body,
    imageUrls: entry.imageUrls,
    authorId: entry.authorId,
    author: entry.author,
    canDelete: actor.role === "LEADER" || entry.authorId === actor.id,
    comments: entry.comments.map((comment) => ({
      id: comment.id,
      body: comment.body,
      author: comment.author,
      canDelete: actor.role === "LEADER" || comment.authorId === actor.id,
    })),
  }));
}
