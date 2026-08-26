"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireActor } from "@/lib/auth";
import { ForbiddenError } from "@/lib/permissions";
import {
  feedbackFormSchema,
  replyFeedbackSchema,
  deleteFeedbackSchema,
} from "@/lib/validators/feedback";
import {
  createFeedback,
  replyToFeedback,
  deleteFeedback,
} from "@/server/services/feedback";
import { NotFoundError } from "@/server/services/task";
import type { ActionResult } from "./task";

async function run<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (error) {
    if (error instanceof ForbiddenError || error instanceof NotFoundError) {
      return { ok: false, message: error.message };
    }
    console.error("[feedback action]", error);
    return { ok: false, message: "บันทึกไม่สำเร็จ กรุณาลองใหม่อีกครั้ง" };
  }
}

function refresh() {
  revalidatePath("/feedback");
  revalidatePath("/board");
  revalidatePath("/dashboard");
}

export async function createFeedbackAction(
  input: unknown,
): Promise<ActionResult<{ ticketNumber: string }>> {
  return run(async () => {
    const actor = await requireActor();
    const parsed = feedbackFormSchema.safeParse(input);
    if (!parsed.success) {
      throw new ForbiddenError(
        parsed.error.issues[0]?.message ?? "ข้อมูลไม่ถูกต้อง",
      );
    }
    const created = await createFeedback(db, actor, parsed.data);
    refresh();
    return { ticketNumber: created.ticketNumber };
  });
}

export async function replyFeedbackAction(
  input: unknown,
): Promise<ActionResult> {
  return run(async () => {
    const actor = await requireActor();
    const parsed = replyFeedbackSchema.safeParse(input);
    if (!parsed.success) {
      throw new ForbiddenError(
        parsed.error.issues[0]?.message ?? "ข้อมูลไม่ถูกต้อง",
      );
    }
    await replyToFeedback(db, actor, parsed.data);
    refresh();
    return undefined;
  });
}

export async function deleteFeedbackAction(
  input: unknown,
): Promise<ActionResult> {
  return run(async () => {
    const actor = await requireActor();
    const parsed = deleteFeedbackSchema.safeParse(input);
    if (!parsed.success) throw new NotFoundError();
    await deleteFeedback(db, actor, parsed.data.id);
    refresh();
    return undefined;
  });
}
