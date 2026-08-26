"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireActor } from "@/lib/auth";
import { ForbiddenError } from "@/lib/permissions";
import {
  createLeaveSchema,
  decideLeaveSchema,
  cancelLeaveSchema,
} from "@/lib/validators/leave";
import { createLeave, decideLeave, cancelLeave } from "@/server/services/leave";
import { loadDayDetail } from "@/server/services/calendar";
import { NotFoundError } from "@/server/services/task";
import type { ActionResult } from "./task";

async function run<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (error) {
    if (error instanceof ForbiddenError || error instanceof NotFoundError) {
      return { ok: false, message: error.message };
    }
    console.error("[leave action]", error);
    return { ok: false, message: "บันทึกไม่สำเร็จ กรุณาลองใหม่อีกครั้ง" };
  }
}

export async function createLeaveAction(input: unknown): Promise<ActionResult> {
  return run(async () => {
    const actor = await requireActor();
    const parsed = createLeaveSchema.safeParse(input);
    if (!parsed.success) {
      throw new ForbiddenError(
        parsed.error.issues[0]?.message ?? "ข้อมูลไม่ถูกต้อง",
      );
    }
    await createLeave(db, actor, parsed.data);
    revalidatePath("/calendar");
    return undefined;
  });
}

export async function decideLeaveAction(input: unknown): Promise<ActionResult> {
  return run(async () => {
    const actor = await requireActor();
    const parsed = decideLeaveSchema.safeParse(input);
    if (!parsed.success) throw new NotFoundError("ไม่พบคำขอลาที่ต้องการ");
    await decideLeave(db, actor, parsed.data.id, parsed.data.status);
    revalidatePath("/calendar");
    return undefined;
  });
}

export async function cancelLeaveAction(input: unknown): Promise<ActionResult> {
  return run(async () => {
    const actor = await requireActor();
    const parsed = cancelLeaveSchema.safeParse(input);
    if (!parsed.success) throw new NotFoundError("ไม่พบคำขอลาที่ต้องการ");
    await cancelLeave(db, actor, parsed.data.id);
    revalidatePath("/calendar");
    return undefined;
  });
}

/** Loaded when a day cell is opened. */
export async function loadDayDetailAction(dayISO: string) {
  const actor = await requireActor();
  return loadDayDetail(db, actor, dayISO);
}
