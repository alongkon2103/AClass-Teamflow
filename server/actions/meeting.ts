"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireActor } from "@/lib/auth";
import { ForbiddenError } from "@/lib/permissions";
import {
  meetingFormSchema,
  updateMeetingSchema,
  deleteMeetingSchema,
} from "@/lib/validators/meeting";
import {
  createMeeting,
  updateMeeting,
  deleteMeeting,
} from "@/server/services/meeting";
import { NotFoundError } from "@/server/services/task";
import type { ActionResult } from "./task";

async function run<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (error) {
    if (error instanceof ForbiddenError || error instanceof NotFoundError) {
      return { ok: false, message: error.message };
    }
    console.error("[meeting action]", error);
    return { ok: false, message: "บันทึกไม่สำเร็จ กรุณาลองใหม่อีกครั้ง" };
  }
}

export async function createMeetingAction(
  input: unknown,
): Promise<ActionResult> {
  return run(async () => {
    const actor = await requireActor();
    const parsed = meetingFormSchema.safeParse(input);
    if (!parsed.success) {
      throw new ForbiddenError(
        parsed.error.issues[0]?.message ?? "ข้อมูลไม่ถูกต้อง",
      );
    }
    await createMeeting(db, actor, parsed.data);
    revalidatePath("/meetings");
    return undefined;
  });
}

export async function updateMeetingAction(
  input: unknown,
): Promise<ActionResult> {
  return run(async () => {
    const actor = await requireActor();
    const parsed = updateMeetingSchema.safeParse(input);
    if (!parsed.success) {
      throw new ForbiddenError(
        parsed.error.issues[0]?.message ?? "ข้อมูลไม่ถูกต้อง",
      );
    }
    await updateMeeting(db, actor, parsed.data.id, parsed.data.data);
    revalidatePath("/meetings");
    return undefined;
  });
}

export async function deleteMeetingAction(
  input: unknown,
): Promise<ActionResult> {
  return run(async () => {
    const actor = await requireActor();
    const parsed = deleteMeetingSchema.safeParse(input);
    if (!parsed.success) throw new NotFoundError("ไม่พบรายการประชุมที่ต้องการ");
    await deleteMeeting(db, actor, parsed.data.id);
    revalidatePath("/meetings");
    return undefined;
  });
}
