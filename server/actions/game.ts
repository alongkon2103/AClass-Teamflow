"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireActor } from "@/lib/auth";
import { ForbiddenError } from "@/lib/permissions";
import {
  gameNameSchema,
  gameIdSchema,
  renameGameSchema,
  setGameActiveSchema,
} from "@/lib/validators/feedback";
import {
  createGame,
  renameGame,
  setGameActive,
  deleteGame,
} from "@/server/services/game";
import { NotFoundError } from "@/server/services/task";
import type { ActionResult } from "./task";

async function run<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (error) {
    if (error instanceof ForbiddenError || error instanceof NotFoundError) {
      return { ok: false, message: error.message };
    }
    console.error("[game action]", error);
    return { ok: false, message: "บันทึกไม่สำเร็จ กรุณาลองใหม่อีกครั้ง" };
  }
}

function refresh() {
  revalidatePath("/settings/games");
  revalidatePath("/feedback");
}

export async function createGameAction(input: unknown): Promise<ActionResult> {
  return run(async () => {
    const actor = await requireActor();
    const parsed = gameNameSchema.safeParse(input);
    if (!parsed.success) {
      throw new ForbiddenError(
        parsed.error.issues[0]?.message ?? "ข้อมูลไม่ถูกต้อง",
      );
    }
    await createGame(db, actor, parsed.data.name);
    refresh();
    return undefined;
  });
}

export async function renameGameAction(input: unknown): Promise<ActionResult> {
  return run(async () => {
    const actor = await requireActor();
    const parsed = renameGameSchema.safeParse(input);
    if (!parsed.success) {
      throw new ForbiddenError(
        parsed.error.issues[0]?.message ?? "ข้อมูลไม่ถูกต้อง",
      );
    }
    await renameGame(db, actor, parsed.data.id, parsed.data.name);
    refresh();
    return undefined;
  });
}

export async function setGameActiveAction(
  input: unknown,
): Promise<ActionResult> {
  return run(async () => {
    const actor = await requireActor();
    const parsed = setGameActiveSchema.safeParse(input);
    if (!parsed.success) throw new NotFoundError("ไม่พบเกมที่ต้องการ");
    await setGameActive(db, actor, parsed.data.id, parsed.data.isActive);
    refresh();
    return undefined;
  });
}

export async function deleteGameAction(input: unknown): Promise<ActionResult> {
  return run(async () => {
    const actor = await requireActor();
    const parsed = gameIdSchema.safeParse(input);
    if (!parsed.success) throw new NotFoundError("ไม่พบเกมที่ต้องการ");
    await deleteGame(db, actor, parsed.data.id);
    refresh();
    return undefined;
  });
}
