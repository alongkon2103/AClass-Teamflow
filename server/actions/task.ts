"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireActor } from "@/lib/auth";
import { ForbiddenError } from "@/lib/permissions";
import {
  createTaskSchema,
  updateTaskSchema,
  moveTaskSchema,
  deleteTaskSchema,
} from "@/lib/validators/task";
import {
  createTask,
  updateTask,
  moveTask,
  archiveTask,
  NotFoundError,
} from "@/server/services/task";

export type ActionResult<T = undefined> =
  { ok: true; data?: T } | { ok: false; message: string };

/**
 * Turns thrown errors into readable Thai messages (SPEC section 7). Anything
 * unexpected is logged server-side and reported generically, never leaked.
 */
async function run<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (error) {
    if (error instanceof ForbiddenError || error instanceof NotFoundError) {
      return { ok: false, message: error.message };
    }
    console.error("[task action]", error);
    return { ok: false, message: "บันทึกไม่สำเร็จ กรุณาลองใหม่อีกครั้ง" };
  }
}

function refreshBoards() {
  revalidatePath("/board");
  revalidatePath("/dashboard");
  revalidatePath("/calendar");
}

export async function createTaskAction(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  return run(async () => {
    const actor = await requireActor();
    const parsed = createTaskSchema.safeParse(input);
    if (!parsed.success) {
      throw new ForbiddenError(
        parsed.error.issues[0]?.message ?? "ข้อมูลไม่ถูกต้อง",
      );
    }
    const task = await createTask(db, actor, parsed.data);
    refreshBoards();
    return { id: task.id };
  });
}

export async function updateTaskAction(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  return run(async () => {
    const actor = await requireActor();
    const parsed = updateTaskSchema.safeParse(input);
    if (!parsed.success) {
      throw new ForbiddenError(
        parsed.error.issues[0]?.message ?? "ข้อมูลไม่ถูกต้อง",
      );
    }
    const task = await updateTask(db, actor, parsed.data.id, parsed.data.data);
    refreshBoards();
    return { id: task.id };
  });
}

/** Called after an optimistic drag; a failure tells the client to roll back. */
export async function moveTaskAction(input: unknown): Promise<ActionResult> {
  return run(async () => {
    const actor = await requireActor();
    const parsed = moveTaskSchema.safeParse(input);
    if (!parsed.success) {
      throw new ForbiddenError("ย้ายงานไม่สำเร็จ");
    }
    await moveTask(db, actor, parsed.data);
    refreshBoards();
    return undefined;
  });
}

export async function deleteTaskAction(input: unknown): Promise<ActionResult> {
  return run(async () => {
    const actor = await requireActor();
    const parsed = deleteTaskSchema.safeParse(input);
    if (!parsed.success) throw new NotFoundError();
    await archiveTask(db, actor, parsed.data.id);
    refreshBoards();
    return undefined;
  });
}
