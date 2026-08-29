import type { PrismaClient } from "@prisma/client";
import { TaskStatus } from "@prisma/client";
import type { Actor } from "@/lib/permissions";
import { formatCalendarDate, todayInBangkok } from "@/lib/date";
import { listBoardTasks } from "@/server/services/task";
import { listMeetings } from "@/server/services/meeting";
import { listNotifications } from "@/server/services/notification";
import {
  bold,
  cyan,
  dim,
  heading,
  info,
  paintPriority,
  red,
  table,
  yellow,
} from "../ui";

/**
 * `teamflow today` — the one command worth running each morning: what is due,
 * what is late, what you are in the middle of, and what is waiting for you.
 */
export async function todayCommand(
  db: PrismaClient,
  actor: Actor & { name: string },
): Promise<void> {
  const now = formatCalendarDate(todayInBangkok());
  const [tasks, meetings, inbox] = await Promise.all([
    listBoardTasks(db, actor, null),
    listMeetings(db),
    listNotifications(db, actor),
  ]);

  const open = tasks.filter((task) => task.status !== TaskStatus.DONE);
  const withDue = open.filter((task) => task.dueDate !== null);

  const overdue = withDue.filter(
    (task) => formatCalendarDate(task.dueDate as Date) < now,
  );
  const dueToday = withDue.filter(
    (task) => formatCalendarDate(task.dueDate as Date) === now,
  );
  const doing = open.filter((task) => task.status === TaskStatus.DOING);
  const today = meetings.filter(
    (meeting) => formatCalendarDate(meeting.meetingAt) === now,
  );

  console.log(`\n${bold(`สวัสดี ${actor.name}`)}  ${dim(now)}`);

  if (overdue.length > 0) {
    heading(red(`เลยกำหนดส่ง (${overdue.length})`));
    table(
      [
        { header: "ID" },
        { header: "กำหนด" },
        { header: "ระดับ" },
        { header: "ชื่องาน" },
      ],
      overdue.map((task) => [
        dim(task.id.slice(0, 8)),
        red(formatCalendarDate(task.dueDate as Date)),
        paintPriority(task.priority),
        task.title,
      ]),
    );
  }

  if (dueToday.length > 0) {
    heading(yellow(`ครบกำหนดวันนี้ (${dueToday.length})`));
    table(
      [{ header: "ID" }, { header: "ระดับ" }, { header: "ชื่องาน" }],
      dueToday.map((task) => [
        dim(task.id.slice(0, 8)),
        paintPriority(task.priority),
        task.title,
      ]),
    );
  }

  heading(`กำลังทำอยู่ (${doing.length})`);
  if (doing.length === 0) {
    info("  ไม่มีงานที่กำลังทำ");
  } else {
    table(
      [{ header: "ID" }, { header: "ชื่องาน" }, { header: "อัปเดตล่าสุด" }],
      doing.map((task) => [
        dim(task.id.slice(0, 8)),
        task.title,
        task._count.progress > 0
          ? `${task._count.progress} ครั้ง`
          : dim("ยังไม่เคยอัปเดต"),
      ]),
    );
  }

  if (today.length > 0) {
    heading(`ประชุมวันนี้ (${today.length})`);
    for (const meeting of today) {
      console.log(
        `  ${cyan(meeting.startTime ?? "ทั้งวัน")}  ${meeting.title}`,
      );
    }
  }

  if (inbox.unreadCount > 0) {
    info(
      `\nมีแจ้งเตือนใหม่ ${inbox.unreadCount} รายการ — ดูด้วย \`teamflow inbox\``,
    );
  }

  if (
    overdue.length === 0 &&
    dueToday.length === 0 &&
    doing.length === 0 &&
    inbox.unreadCount === 0
  ) {
    info("\nวันนี้ไม่มีอะไรค้าง");
  }
}
