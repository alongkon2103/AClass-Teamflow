import type { PrismaClient } from "@prisma/client";
import { type Actor, assertCan } from "@/lib/permissions";
import { parseCalendarDate } from "@/lib/date";
import { NotFoundError } from "./task";

/** Meeting minutes, newest first — the order the history panel reads in. */
export async function listMeetings(db: PrismaClient) {
  return db.meeting.findMany({
    select: {
      id: true,
      title: true,
      meetingAt: true,
      summary: true,
      createdAt: true,
      createdBy: {
        select: { id: true, name: true, avatarColor: true, avatarUrl: true },
      },
    },
    orderBy: [{ meetingAt: "desc" }, { createdAt: "desc" }],
  });
}

export type MeetingInput = {
  title: string;
  meetingAt: string;
  summary: string;
};

export async function createMeeting(
  db: PrismaClient,
  actor: Actor,
  input: MeetingInput,
) {
  assertCan(actor, { type: "meeting:manage" });

  return db.meeting.create({
    data: {
      title: input.title,
      meetingAt: parseCalendarDate(input.meetingAt),
      summary: input.summary,
      createdById: actor.id,
    },
    select: { id: true },
  });
}

export async function updateMeeting(
  db: PrismaClient,
  actor: Actor,
  id: string,
  input: MeetingInput,
) {
  assertCan(actor, { type: "meeting:manage" });

  const existing = await db.meeting.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!existing) throw new NotFoundError("ไม่พบรายการประชุมที่ต้องการ");

  return db.meeting.update({
    where: { id },
    data: {
      title: input.title,
      meetingAt: parseCalendarDate(input.meetingAt),
      summary: input.summary,
    },
    select: { id: true },
  });
}

export async function deleteMeeting(
  db: PrismaClient,
  actor: Actor,
  id: string,
) {
  assertCan(actor, { type: "meeting:manage" });

  const existing = await db.meeting.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!existing) throw new NotFoundError("ไม่พบรายการประชุมที่ต้องการ");

  await db.meeting.delete({ where: { id } });
  return { id };
}
