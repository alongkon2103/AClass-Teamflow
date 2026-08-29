import type { PrismaClient } from "@prisma/client";
import type { Actor } from "@/lib/permissions";
import { formatCalendarDate, todayInBangkok } from "@/lib/date";
import { createProgress } from "@/server/services/progress";
import { createProgressSchema } from "@/lib/validators/progress";
import { listMeetings } from "@/server/services/meeting";
import {
  listNotifications,
  markAllRead,
  notificationMessage,
  type NotificationPayload,
} from "@/server/services/notification";
import type { Args } from "../args";
import { flagValue, hasFlag } from "../args";
import { resolveTask } from "../resolve";
import { textToRichText } from "../mentions";
import {
  bold,
  cyan,
  dim,
  docToTerminal,
  heading,
  info,
  success,
  table,
} from "../ui";

/** `teamflow log <ref> "<text>"` — the daily update, mentions and all. */
export async function logCommand(
  db: PrismaClient,
  actor: Actor,
  args: Args,
): Promise<void> {
  const [reference, ...rest] = args.positional;
  const text = rest.join(" ").trim();
  if (!reference || !text) {
    throw new Error(
      'ใช้: teamflow log <งาน> "<ความคืบหน้า>" [--date 2026-08-29]',
    );
  }

  const task = await resolveTask(db, actor, reference);
  const members = await db.user.findMany({
    where: { isActive: true },
    select: { id: true, name: true },
  });

  const parsed = createProgressSchema.safeParse({
    taskId: task.id,
    entryDate: flagValue(args, "date") ?? formatCalendarDate(todayInBangkok()),
    body: textToRichText(text, members),
    imageUrls: [],
  });
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "ข้อมูลไม่ถูกต้อง");
  }

  await createProgress(db, actor, parsed.data);
  success(`บันทึกความคืบหน้าของ "${task.title}" แล้ว`);

  const mentioned = text.match(/@\[[^\]]+\]|@\S+/g);
  if (mentioned) info(`แจ้งเตือนไปยัง: ${mentioned.join(" ")}`);
}

/** `teamflow inbox` — unread notifications, newest first. */
export async function inboxCommand(
  db: PrismaClient,
  actor: Actor,
  args: Args,
): Promise<void> {
  if (hasFlag(args, "read")) {
    await markAllRead(db, actor);
    success("ทำเครื่องหมายว่าอ่านแล้วทั้งหมด");
    return;
  }

  const { rows, unreadCount } = await listNotifications(db, actor);
  const shown = hasFlag(args, "all") ? rows : rows.filter((row) => !row.readAt);

  if (shown.length === 0) {
    info(unreadCount === 0 ? "ไม่มีแจ้งเตือนใหม่" : "ไม่มีรายการที่ตรงกัน");
    return;
  }

  for (const row of shown) {
    const payload = (row.payload ?? {}) as NotificationPayload;
    const mark = row.readAt ? dim("·") : cyan("●");
    const when = row.createdAt.toISOString().slice(0, 10);
    console.log(
      `${mark} ${dim(when)}  ${notificationMessage(row.type, payload, row.actor?.name ?? null)}`,
    );
    if (payload.excerpt) info(`    ${payload.excerpt}`);
  }
  info(
    `\nยังไม่ได้อ่าน ${unreadCount} รายการ — สั่ง \`teamflow inbox --read\` เพื่อล้าง`,
  );
}

/** `teamflow meetings` — what is booked, and the last write-ups. */
export async function meetingsCommand(
  db: PrismaClient,
  args: Args,
): Promise<void> {
  const meetings = await listMeetings(db);
  const now = formatCalendarDate(todayInBangkok());

  const upcoming = meetings
    .filter((meeting) => formatCalendarDate(meeting.meetingAt) >= now)
    .reverse();

  heading("การประชุมที่จะถึง");
  if (upcoming.length === 0) {
    info("  ไม่มีนัดประชุม");
  } else {
    table(
      [{ header: "วันที่" }, { header: "เวลา" }, { header: "หัวข้อ" }],
      upcoming.map((meeting) => [
        formatCalendarDate(meeting.meetingAt),
        meeting.startTime ?? dim("—"),
        meeting.title,
      ]),
    );
  }

  if (!hasFlag(args, "past")) {
    info("\nดูบันทึกย้อนหลังด้วย `teamflow meetings --past`");
    return;
  }

  heading("บันทึกการประชุมย้อนหลัง");
  const past = meetings.filter(
    (meeting) => formatCalendarDate(meeting.meetingAt) < now,
  );
  if (past.length === 0) {
    info("  ยังไม่มีบันทึก");
    return;
  }

  for (const meeting of past.slice(0, 10)) {
    console.log(
      `\n  ${cyan(formatCalendarDate(meeting.meetingAt))}  ${bold(meeting.title)}`,
    );
    if (meeting.summary) console.log(docToTerminal(meeting.summary, "    "));
    else info("    ยังไม่ได้บันทึกสรุปผล");
  }
}
