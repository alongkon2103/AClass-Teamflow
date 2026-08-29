import type { PrismaClient } from "@prisma/client";
import { type Actor, assertCan } from "@/lib/permissions";
import { parseCalendarDate } from "@/lib/date";
import { NotFoundError } from "./task";
import { notifyMentions } from "./mention";
import type { RichTextDoc } from "@/lib/rich-text";

/** Meeting minutes, newest first — the order the history panel reads in. */
export async function listMeetings(db: PrismaClient) {
  return db.meeting.findMany({
    select: {
      id: true,
      title: true,
      meetingAt: true,
      startTime: true,
      description: true,
      summary: true,
      createdAt: true,
      createdBy: {
        select: { id: true, name: true, avatarColor: true, avatarUrl: true },
      },
    },
    orderBy: [{ meetingAt: "desc" }, { startTime: "desc" }],
  });
}

/** Meetings booked on days within a range, for the calendar. */
export async function listMeetingsInRange(
  db: PrismaClient,
  fromISO: string,
  toISO: string,
) {
  return db.meeting.findMany({
    where: {
      meetingAt: {
        gte: parseCalendarDate(fromISO),
        lte: parseCalendarDate(toISO),
      },
    },
    select: {
      id: true,
      title: true,
      meetingAt: true,
      startTime: true,
      description: true,
      summary: true,
    },
    orderBy: [{ meetingAt: "asc" }, { startTime: "asc" }],
  });
}

export type MeetingInput = {
  title: string;
  meetingAt: string;
  startTime: string | null;
  description: RichTextDoc | null;
  summary: RichTextDoc | null;
};

export async function createMeeting(
  db: PrismaClient,
  actor: Actor,
  input: MeetingInput,
) {
  assertCan(actor, { type: "meeting:manage" });

  return db.$transaction(async (tx) => {
    const meeting = await tx.meeting.create({
      data: {
        title: input.title,
        meetingAt: parseCalendarDate(input.meetingAt),
        startTime: input.startTime,
        description: input.description ?? undefined,
        summary: input.summary ?? undefined,
        createdById: actor.id,
      },
      select: { id: true, title: true },
    });

    const notified = await notifyMentions(tx, actor, input.description, {
      meetingId: meeting.id,
      meetingTitle: meeting.title,
    });
    await notifyMentions(
      tx,
      actor,
      input.summary,
      { meetingId: meeting.id, meetingTitle: meeting.title },
      notified,
    );

    return { id: meeting.id };
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

  return db.$transaction(async (tx) => {
    const meeting = await tx.meeting.update({
      where: { id },
      data: {
        title: input.title,
        meetingAt: parseCalendarDate(input.meetingAt),
        startTime: input.startTime,
        description: input.description ?? undefined,
        summary: input.summary ?? undefined,
      },
      select: { id: true, title: true },
    });

    const notified = await notifyMentions(tx, actor, input.description, {
      meetingId: meeting.id,
      meetingTitle: meeting.title,
    });
    await notifyMentions(
      tx,
      actor,
      input.summary,
      { meetingId: meeting.id, meetingTitle: meeting.title },
      notified,
    );

    return { id: meeting.id };
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
