import type { PrismaClient } from "@prisma/client";
import { type Actor, assertCan } from "@/lib/permissions";
import { NotFoundError } from "./task";
import { ForbiddenError } from "@/lib/permissions";

/** Games referenced by tasks or feedback are deactivated, never deleted. */
export async function listGames(db: PrismaClient) {
  const games = await db.game.findMany({
    select: {
      id: true,
      name: true,
      isActive: true,
      createdAt: true,
      _count: { select: { feedbacks: true, tasks: true } },
    },
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
  });

  return games.map((game) => ({
    id: game.id,
    name: game.name,
    isActive: game.isActive,
    feedbackCount: game._count.feedbacks,
    taskCount: game._count.tasks,
    // Only an unreferenced game may be removed for good (SPEC 5.7).
    canDelete: game._count.feedbacks === 0 && game._count.tasks === 0,
  }));
}

export async function createGame(db: PrismaClient, actor: Actor, name: string) {
  assertCan(actor, { type: "game:manage" });

  const trimmed = name.trim();
  if (!trimmed) throw new ForbiddenError("กรุณากรอกชื่อเกม");

  // Case-insensitive uniqueness (SPEC 5.7); the column's unique index only
  // catches exact duplicates.
  const clash = await db.game.findFirst({
    where: { name: { equals: trimmed, mode: "insensitive" } },
    select: { id: true },
  });
  if (clash) throw new ForbiddenError("มีเกมชื่อนี้อยู่แล้ว");

  return db.game.create({
    data: { name: trimmed },
    select: { id: true, name: true },
  });
}

export async function renameGame(
  db: PrismaClient,
  actor: Actor,
  id: string,
  name: string,
) {
  assertCan(actor, { type: "game:manage" });

  const trimmed = name.trim();
  if (!trimmed) throw new ForbiddenError("กรุณากรอกชื่อเกม");

  const clash = await db.game.findFirst({
    where: { name: { equals: trimmed, mode: "insensitive" }, id: { not: id } },
    select: { id: true },
  });
  if (clash) throw new ForbiddenError("มีเกมชื่อนี้อยู่แล้ว");

  return db.game.update({
    where: { id },
    data: { name: trimmed },
    select: { id: true, name: true },
  });
}

export async function setGameActive(
  db: PrismaClient,
  actor: Actor,
  id: string,
  isActive: boolean,
) {
  assertCan(actor, { type: "game:manage" });
  return db.game.update({
    where: { id },
    data: { isActive },
    select: { id: true, isActive: true },
  });
}

export async function deleteGame(db: PrismaClient, actor: Actor, id: string) {
  assertCan(actor, { type: "game:manage" });

  const game = await db.game.findUnique({
    where: { id },
    select: { id: true, _count: { select: { feedbacks: true, tasks: true } } },
  });
  if (!game) throw new NotFoundError("ไม่พบเกมที่ต้องการ");

  if (game._count.feedbacks > 0 || game._count.tasks > 0) {
    throw new ForbiddenError(
      "ลบไม่ได้เพราะมีงานหรือฟีดแบคอ้างอิงอยู่ ให้ปิดใช้งานแทน",
    );
  }

  await db.game.delete({ where: { id } });
  return { id };
}
