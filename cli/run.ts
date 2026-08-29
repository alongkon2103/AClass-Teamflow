import { Prisma } from "@prisma/client";
import { db } from "./db";
import { ForbiddenError } from "@/lib/permissions";
import { NotFoundError } from "@/server/services/task";
import { flagValue, parseArgs } from "./args";
import {
  clearSession,
  login,
  readSession,
  requireActor,
  sessionPath,
} from "./session";
import { bold, dim, fail, info, success } from "./ui";
import {
  archiveCommand,
  listCommand,
  moveCommand,
  newCommand,
  showCommand,
  teamCommand,
} from "./commands/tasks";
import { inboxCommand, logCommand, meetingsCommand } from "./commands/updates";
import { todayCommand } from "./commands/today";

const HELP = `
${bold("teamflow")} — TeamFlow จากบรรทัดคำสั่ง

${bold("โหมดโต้ตอบ")}
  ${dim("teamflow")}                       เปิดบอร์ดแบบเลื่อนด้วยลูกศร (ไม่ต้องใส่คำสั่ง)
                                 ↑↓ เลื่อน · Enter เปิดดู · m ย้ายสถานะ
                                 l บันทึกความคืบหน้า · d สลับงานที่เสร็จ · q ออก

${bold("บัญชี")}
  login [--email อีเมล]           เข้าสู่ระบบ (ส่งรหัสผ่านทาง stdin ก็ได้)
  whoami                         ดูว่ากำลังใช้บัญชีไหน
  logout                         ออกจากระบบ

${bold("งาน")}
  today                          สรุปของวันนี้: เลยกำหนด ครบกำหนด กำลังทำ ประชุม
  ls [--status s] [--user ชื่อ]   ดูรายการงาน (ซ่อนงานที่เสร็จแล้ว ใช้ --all เพื่อดูทั้งหมด)
  show <งาน>                     ดูงานหนึ่งงานพร้อมความคืบหน้าทั้งหมด
  new "<ชื่องาน>"                 สร้างงานใหม่
                                 --assign ชื่อ,ชื่อ  --due 2026-09-01  --start
                                 --status  --priority  --game  --desc
  move <งาน> <สถานะ>              ย้ายสถานะ (todo | doing | review | done)
  archive <งาน> --yes            เก็บงานเข้าคลัง

${bold("ความคืบหน้าและทีม")}
  log <งาน> "<ข้อความ>"           บันทึกความคืบหน้า ใส่ @ชื่อ เพื่อ mention ได้
                                 --date 2026-08-29
  inbox [--read] [--all]         แจ้งเตือนของคุณ
  meetings [--past]              นัดประชุมและบันทึกย้อนหลัง
  team                           ภาระงานรายบุคคล

${bold("อ้างถึงงาน")}
  ใช้ id เต็ม, ตัวขึ้นต้นของ id (เช่น ${dim("cmtayjxf")}) หรือบางส่วนของชื่องานก็ได้
  ถ้าตรงหลายงานจะขึ้นรายการให้เลือก ไม่เดาให้

${bold("ตัวอย่าง")}
  teamflow today
  teamflow ls --status doing
  teamflow log payment "แก้บั๊กหน้าชำระเงินเสร็จแล้ว ฝาก @Mashe ตรวจต่อ"
  teamflow new "ทำหน้า setting" --assign Poon --due 2026-09-05 --priority urgent
`;

export async function run(argv: string[]): Promise<number> {
  const command = argv[0];
  const args = parseArgs(argv.slice(1));

  if (command === "help" || command === "--help") {
    console.log(HELP);
    return 0;
  }

  try {
    // No command at all opens the keyboard-driven board, which is the fastest
    // way in; `teamflow help` still lists everything.
    if (!command || command === "ui") {
      const { browse } = await import("./browse");
      await browse(db, await requireActor(db));
      return 0;
    }

    switch (command) {
      case "login": {
        await login(db, flagValue(args, "email"));
        const actor = await requireActor(db);
        success(`เข้าสู่ระบบเป็น ${actor.name} (${actor.email})`);
        info(`เก็บ session ไว้ที่ ${sessionPath()}`);
        return 0;
      }

      case "logout": {
        clearSession();
        success("ออกจากระบบแล้ว");
        return 0;
      }

      case "whoami": {
        const session = readSession();
        if (!session) {
          info("ยังไม่ได้เข้าสู่ระบบ");
          return 1;
        }
        const actor = await requireActor(db);
        console.log(
          `${bold(actor.name)} ${dim(`<${actor.email}>`)} — ${actor.role === "LEADER" ? "หัวหน้าทีม" : "สมาชิก"}`,
        );
        return 0;
      }

      case "today":
        await todayCommand(db, await requireActor(db));
        return 0;

      case "ls":
      case "list":
        await listCommand(db, await requireActor(db), args);
        return 0;

      case "show":
      case "view":
        await showCommand(db, await requireActor(db), args);
        return 0;

      case "new":
      case "add":
        await newCommand(db, await requireActor(db), args);
        return 0;

      case "move":
        await moveCommand(db, await requireActor(db), args);
        return 0;

      case "archive":
        await archiveCommand(db, await requireActor(db), args);
        return 0;

      case "log":
      case "progress":
        await logCommand(db, await requireActor(db), args);
        return 0;

      case "inbox":
      case "notifications":
        await inboxCommand(db, await requireActor(db), args);
        return 0;

      case "meetings":
        await requireActor(db);
        await meetingsCommand(db, args);
        return 0;

      case "team":
        await requireActor(db);
        await teamCommand(db);
        return 0;

      default:
        fail(`ไม่รู้จักคำสั่ง "${command}"`);
        info("ดูคำสั่งทั้งหมดด้วย `teamflow help`");
        return 1;
    }
  } catch (error) {
    // Prisma's own message is a stack dump with the failing query in it, which
    // tells the reader nothing they can act on.
    if (error instanceof Prisma.PrismaClientInitializationError) {
      fail("ต่อฐานข้อมูลไม่ได้");
      info(
        "เปิด SSH tunnel ไปยัง server ก่อน หรือรันคำสั่งนี้บนเครื่อง server เอง",
      );
      return 1;
    }
    if (error instanceof ForbiddenError) {
      fail(error.message);
      return 1;
    }
    if (error instanceof NotFoundError) {
      fail("ไม่พบข้อมูลที่ต้องการ");
      return 1;
    }
    fail(error instanceof Error ? error.message : String(error));
    return 1;
  } finally {
    // Disconnecting a client that never connected must not mask the real error.
    await db.$disconnect().catch(() => undefined);
  }
}
