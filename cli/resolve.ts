import type { PrismaClient, TaskStatus, Priority } from "@prisma/client";
import { TaskStatus as Status, Priority as Level } from "@prisma/client";
import type { Actor } from "@/lib/permissions";
import { taskVisibilityFilter } from "@/lib/permissions";
import { canPrompt } from "./prompt";

/**
 * Task references, so nobody has to type a cuid.
 *
 * Accepts the full id, a unique id prefix (like a short git hash), or a unique
 * piece of the title. Several matches never resolves to a guess: in a terminal
 * it becomes a picker, and in a script it is an error listing the candidates.
 */
export async function resolveTask(
  db: PrismaClient,
  actor: Actor,
  reference: string,
): Promise<{ id: string; title: string }> {
  const needle = reference.trim();
  if (needle === "") throw new Error("ต้องระบุงานที่ต้องการ");

  const visible = { archivedAt: null, ...taskVisibilityFilter(actor) };

  const exact = await db.task.findFirst({
    where: { ...visible, id: needle },
    select: { id: true, title: true },
  });
  if (exact) return exact;

  const matches = await db.task.findMany({
    where: {
      ...visible,
      OR: [
        { id: { startsWith: needle } },
        { title: { contains: needle, mode: "insensitive" } },
      ],
    },
    select: { id: true, title: true },
    take: 10,
  });

  if (matches.length === 1) return matches[0];
  if (matches.length === 0) {
    throw new Error(`ไม่พบงานที่ตรงกับ "${needle}"`);
  }

  // In a terminal the ambiguity is a question, not an error: pick from a list.
  if (canPrompt()) {
    const { pickTask } = await import("./browse");
    const chosen = await pickTask(matches);
    if (!chosen) throw new Error("ยกเลิกแล้ว");
    return matches.find(
      (task) => task.id === chosen,
    ) as (typeof matches)[number];
  }

  const list = matches
    .map((task) => `  ${task.id.slice(0, 8)}  ${task.title}`)
    .join("\n");
  throw new Error(`"${needle}" ตรงกับหลายงาน ระบุให้ชัดกว่านี้:\n${list}`);
}

const STATUS_WORDS: Record<string, TaskStatus> = {
  todo: Status.TODO,
  ต้องทำ: Status.TODO,
  doing: Status.DOING,
  กำลังทำ: Status.DOING,
  review: Status.REVIEW,
  รอตรวจ: Status.REVIEW,
  รอส่งตรวจ: Status.REVIEW,
  done: Status.DONE,
  เสร็จ: Status.DONE,
  เสร็จสิ้น: Status.DONE,
};

export function parseStatus(word: string): TaskStatus {
  const status = STATUS_WORDS[word.trim().toLowerCase()];
  if (!status) {
    throw new Error(
      `สถานะ "${word}" ไม่ถูกต้อง — ใช้ได้: todo, doing, review, done`,
    );
  }
  return status;
}

const PRIORITY_WORDS: Record<string, Priority> = {
  normal: Level.NORMAL,
  ปกติ: Level.NORMAL,
  important: Level.IMPORTANT,
  สำคัญ: Level.IMPORTANT,
  urgent: Level.URGENT,
  ด่วน: Level.URGENT,
};

export function parsePriority(word: string): Priority {
  const priority = PRIORITY_WORDS[word.trim().toLowerCase()];
  if (!priority) {
    throw new Error(
      `ความสำคัญ "${word}" ไม่ถูกต้อง — ใช้ได้: normal, important, urgent`,
    );
  }
  return priority;
}

/** Finds one active member by name or email; used by --assign and --user. */
export async function resolveMember(
  db: PrismaClient,
  reference: string,
): Promise<{ id: string; name: string }> {
  const needle = reference.trim();
  const matches = await db.user.findMany({
    where: {
      isActive: true,
      OR: [
        { name: { contains: needle, mode: "insensitive" } },
        { email: { equals: needle, mode: "insensitive" } },
      ],
    },
    select: { id: true, name: true },
    take: 10,
  });

  if (matches.length === 1) return matches[0];
  if (matches.length === 0) throw new Error(`ไม่พบสมาชิกชื่อ "${needle}"`);
  throw new Error(
    `"${needle}" ตรงกับหลายคน: ${matches.map((m) => m.name).join(", ")}`,
  );
}
