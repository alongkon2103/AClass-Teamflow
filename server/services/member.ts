import type { PrismaClient } from "@prisma/client";
import { Role } from "@prisma/client";
import bcrypt from "bcryptjs";
import { type Actor, assertCan, ForbiddenError } from "@/lib/permissions";
import { AVATAR_PALETTE } from "@/lib/constants";
import { NotFoundError } from "./task";

export const BCRYPT_COST = 12;

/**
 * Picks a palette colour no active member is using yet; falls back to the
 * least-used one once the palette is exhausted (SPEC 5.8).
 */
export function pickAvatarColour(taken: string[]): string {
  const unused = AVATAR_PALETTE.find((colour) => !taken.includes(colour));
  if (unused) return unused;

  const counts = new Map<string, number>();
  for (const colour of AVATAR_PALETTE) counts.set(colour, 0);
  for (const colour of taken) {
    if (counts.has(colour)) counts.set(colour, (counts.get(colour) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => a[1] - b[1])[0][0];
}

export async function listMembers(db: PrismaClient) {
  return db.user.findMany({
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      jobTitle: true,
      avatarColor: true,
      isActive: true,
      mustChangePassword: true,
      _count: { select: { assignedTasks: true } },
    },
    orderBy: [{ isActive: "desc" }, { role: "asc" }, { name: "asc" }],
  });
}

export type CreateMemberInput = {
  name: string;
  email: string;
  jobTitle: string | null;
  role: Role;
  temporaryPassword: string;
};

export async function createMember(
  db: PrismaClient,
  actor: Actor,
  input: CreateMemberInput,
) {
  assertCan(actor, { type: "member:manage" });

  const email = input.email.trim().toLowerCase();
  const existing = await db.user.findUnique({
    where: { email },
    select: { id: true },
  });
  if (existing) throw new ForbiddenError("อีเมลนี้ถูกใช้งานแล้ว");

  const taken = (await db.user.findMany({ select: { avatarColor: true } })).map(
    (user) => user.avatarColor,
  );

  return db.user.create({
    data: {
      email,
      name: input.name.trim(),
      jobTitle: input.jobTitle,
      role: input.role,
      avatarColor: pickAvatarColour(taken),
      passwordHash: await bcrypt.hash(input.temporaryPassword, BCRYPT_COST),
      // A leader-issued password must be replaced on first sign-in.
      mustChangePassword: true,
    },
    select: { id: true, email: true, name: true },
  });
}

export type UpdateMemberInput = {
  id: string;
  name: string;
  jobTitle: string | null;
  role: Role;
};

export async function updateMember(
  db: PrismaClient,
  actor: Actor,
  input: UpdateMemberInput,
) {
  assertCan(actor, { type: "member:manage" });

  const member = await db.user.findUnique({
    where: { id: input.id },
    select: { id: true, role: true },
  });
  if (!member) throw new NotFoundError("ไม่พบสมาชิกที่ต้องการ");

  // Never let the last leader demote themselves out of the role.
  if (member.role === Role.LEADER && input.role !== Role.LEADER) {
    await assertAnotherLeaderExists(db, member.id);
  }

  return db.user.update({
    where: { id: input.id },
    data: {
      name: input.name.trim(),
      jobTitle: input.jobTitle,
      role: input.role,
    },
    select: { id: true },
  });
}

export async function setMemberActive(
  db: PrismaClient,
  actor: Actor,
  id: string,
  isActive: boolean,
) {
  assertCan(actor, { type: "member:manage" });

  if (!isActive) {
    if (id === actor.id) {
      throw new ForbiddenError("ปิดใช้งานบัญชีของตัวเองไม่ได้");
    }
    const member = await db.user.findUnique({
      where: { id },
      select: { role: true },
    });
    if (member?.role === Role.LEADER) await assertAnotherLeaderExists(db, id);
  }

  return db.user.update({
    where: { id },
    data: { isActive },
    select: { id: true, isActive: true },
  });
}

/** Leader-issued password reset; forces a change at next sign-in. */
export async function resetMemberPassword(
  db: PrismaClient,
  actor: Actor,
  id: string,
  temporaryPassword: string,
) {
  assertCan(actor, { type: "member:manage" });

  return db.user.update({
    where: { id },
    data: {
      passwordHash: await bcrypt.hash(temporaryPassword, BCRYPT_COST),
      mustChangePassword: true,
    },
    select: { id: true },
  });
}

/** Self-service password change (SPEC 5.1). */
export async function changeOwnPassword(
  db: PrismaClient,
  actor: Actor,
  currentPassword: string,
  newPassword: string,
) {
  const user = await db.user.findUnique({
    where: { id: actor.id },
    select: { id: true, passwordHash: true },
  });
  if (!user) throw new NotFoundError("ไม่พบบัญชีผู้ใช้");

  const matches = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!matches) throw new ForbiddenError("รหัสผ่านปัจจุบันไม่ถูกต้อง");

  await db.user.update({
    where: { id: user.id },
    data: {
      passwordHash: await bcrypt.hash(newPassword, BCRYPT_COST),
      mustChangePassword: false,
    },
  });

  return { id: user.id };
}

async function assertAnotherLeaderExists(db: PrismaClient, excludeId: string) {
  const others = await db.user.count({
    where: { role: Role.LEADER, isActive: true, id: { not: excludeId } },
  });
  if (others === 0) {
    throw new ForbiddenError("ต้องมีหัวหน้าทีมที่ใช้งานได้อย่างน้อยหนึ่งคน");
  }
}
