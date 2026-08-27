"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireActor } from "@/lib/auth";
import { ForbiddenError } from "@/lib/permissions";
import {
  createMemberSchema,
  updateMemberSchema,
  setMemberActiveSchema,
  resetPasswordSchema,
  setAvatarSchema,
} from "@/lib/validators/member";
import { changePasswordSchema } from "@/lib/validators/auth";
import {
  createMember,
  updateMember,
  setMemberActive,
  resetMemberPassword,
  changeOwnPassword,
  setOwnAvatar,
} from "@/server/services/member";
import { NotFoundError } from "@/server/services/task";
import type { ActionResult } from "./task";

async function run<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (error) {
    if (error instanceof ForbiddenError || error instanceof NotFoundError) {
      return { ok: false, message: error.message };
    }
    console.error("[member action]", error);
    return { ok: false, message: "บันทึกไม่สำเร็จ กรุณาลองใหม่อีกครั้ง" };
  }
}

function refresh() {
  revalidatePath("/settings/members");
  revalidatePath("/dashboard");
  revalidatePath("/board");
}

export async function createMemberAction(
  input: unknown,
): Promise<ActionResult> {
  return run(async () => {
    const actor = await requireActor();
    const parsed = createMemberSchema.safeParse(input);
    if (!parsed.success) {
      throw new ForbiddenError(
        parsed.error.issues[0]?.message ?? "ข้อมูลไม่ถูกต้อง",
      );
    }
    await createMember(db, actor, parsed.data);
    refresh();
    return undefined;
  });
}

export async function updateMemberAction(
  input: unknown,
): Promise<ActionResult> {
  return run(async () => {
    const actor = await requireActor();
    const parsed = updateMemberSchema.safeParse(input);
    if (!parsed.success) {
      throw new ForbiddenError(
        parsed.error.issues[0]?.message ?? "ข้อมูลไม่ถูกต้อง",
      );
    }
    await updateMember(db, actor, parsed.data);
    refresh();
    return undefined;
  });
}

export async function setMemberActiveAction(
  input: unknown,
): Promise<ActionResult> {
  return run(async () => {
    const actor = await requireActor();
    const parsed = setMemberActiveSchema.safeParse(input);
    if (!parsed.success) throw new NotFoundError("ไม่พบสมาชิกที่ต้องการ");
    await setMemberActive(db, actor, parsed.data.id, parsed.data.isActive);
    refresh();
    return undefined;
  });
}

export async function resetMemberPasswordAction(
  input: unknown,
): Promise<ActionResult> {
  return run(async () => {
    const actor = await requireActor();
    const parsed = resetPasswordSchema.safeParse(input);
    if (!parsed.success) {
      throw new ForbiddenError(
        parsed.error.issues[0]?.message ?? "ข้อมูลไม่ถูกต้อง",
      );
    }
    await resetMemberPassword(
      db,
      actor,
      parsed.data.id,
      parsed.data.temporaryPassword,
    );
    refresh();
    return undefined;
  });
}

/** Anyone may set their own photo; nobody may set someone else's. */
export async function setOwnAvatarAction(
  input: unknown,
): Promise<ActionResult> {
  return run(async () => {
    const actor = await requireActor();
    const parsed = setAvatarSchema.safeParse(input);
    if (!parsed.success) {
      throw new ForbiddenError(
        parsed.error.issues[0]?.message ?? "ข้อมูลไม่ถูกต้อง",
      );
    }
    await setOwnAvatar(db, actor, parsed.data.avatarUrl);
    refresh();
    revalidatePath("/account");
    return undefined;
  });
}

export async function changePasswordAction(
  input: unknown,
): Promise<ActionResult> {
  return run(async () => {
    const actor = await requireActor();
    const parsed = changePasswordSchema.safeParse(input);
    if (!parsed.success) {
      throw new ForbiddenError(
        parsed.error.issues[0]?.message ?? "ข้อมูลไม่ถูกต้อง",
      );
    }
    await changeOwnPassword(
      db,
      actor,
      parsed.data.currentPassword,
      parsed.data.newPassword,
    );
    return undefined;
  });
}
