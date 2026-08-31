"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireActor } from "@/lib/auth";
import { ForbiddenError } from "@/lib/permissions";
import { restoreTask } from "@/server/services/archive";
import { NotFoundError } from "@/server/services/task";
import type { ActionResult } from "./task";

const restoreSchema = z.object({ id: z.string().min(1) });

export async function restoreTaskAction(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  try {
    const actor = await requireActor();
    const parsed = restoreSchema.safeParse(input);
    if (!parsed.success) throw new ForbiddenError("ข้อมูลไม่ถูกต้อง");

    const task = await restoreTask(db, actor, parsed.data.id);
    revalidatePath("/archive");
    revalidatePath("/board");
    revalidatePath("/dashboard");
    return { ok: true, data: { id: task.id } };
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return { ok: false, message: error.message };
    }
    if (error instanceof NotFoundError) {
      return { ok: false, message: "ไม่พบงานนี้ในคลัง" };
    }
    console.error("[archive action]", error);
    return { ok: false, message: "นำงานกลับไม่สำเร็จ กรุณาลองใหม่อีกครั้ง" };
  }
}
