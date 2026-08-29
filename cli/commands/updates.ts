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
import { formatThaiDate } from "@/lib/format";
import {
  bold,
  cyan,
  dim,
  docToTerminal,
  info,
  rule,
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

  table(
    [{ header: "" }, { header: "วันที่" }, { header: "เรื่อง", flex: true }],
    shown.map((row) => {
      const payload = (row.payload ?? {}) as NotificationPayload;
      const message = notificationMessage(
        row.type,
        payload,
        row.actor?.name ?? null,
      );
      return [
        row.readAt ? dim("·") : cyan("●"),
        formatThaiDate(row.createdAt.toISOString().slice(0, 10)),
        // The table is one line per row, so the excerpt trails the message and
        // the column truncates the pair as a whole.
        payload.excerpt ? `${message} ${dim(`— ${payload.excerpt}`)}` : message,
      ];
    }),
  );
  info(
    `  ยังไม่ได้อ่าน ${unreadCount} รายการ — สั่ง \`teamflow inbox --read\` เพื่อล้าง`,
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

  console.log("");
  rule("การประชุมที่จะถึง");
  if (upcoming.length === 0) {
    info("  ไม่มีนัดประชุม");
  } else {
    table(
      [
        { header: "วันที่" },
        { header: "เวลา" },
        { header: "หัวข้อ", flex: true },
        { header: "จดโดย" },
      ],
      upcoming.map((meeting) => [
        formatThaiDate(formatCalendarDate(meeting.meetingAt)),
        meeting.startTime ? `${meeting.startTime} น.` : dim("ทั้งวัน"),
        meeting.title,
        dim(meeting.createdBy.name),
      ]),
    );
  }

  if (!hasFlag(args, "past")) {
    info("  ดูบันทึกย้อนหลังด้วย `teamflow meetings --past`");
    return;
  }

  console.log("");
  rule("บันทึกการประชุมย้อนหลัง");
  const past = meetings.filter(
    (meeting) => formatCalendarDate(meeting.meetingAt) < now,
  );
  if (past.length === 0) {
    info("  ยังไม่มีบันทึก");
    return;
  }

  for (const meeting of past.slice(0, 10)) {
    const when = formatThaiDate(formatCalendarDate(meeting.meetingAt));
    console.log(`\n  ${cyan("●")} ${bold(meeting.title)}  ${dim(when)}`);
    if (meeting.summary) {
      console.log(docToTerminal(meeting.summary, `  ${dim("│")} `));
    } else {
      console.log(`  ${dim("│")} ${dim("ยังไม่ได้บันทึกสรุปผล")}`);
    }
  }
}
