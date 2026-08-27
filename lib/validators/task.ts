import { z } from "zod";
import { TaskStatus, Priority } from "@prisma/client";

/**
 * Shared by the task dialog (client) and the server actions (server), so the
 * same rules run in both places (SPEC section 1).
 *
 * Empty HTML controls submit "", so optional fields are normalised to null in a
 * single object-level transform *before* the format checks run — otherwise a
 * blank date input would fail the date regex.
 */

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** "" / null / undefined all mean "not set". */
function blank(value: string | null | undefined): string | null {
  const text = (value ?? "").trim();
  return text === "" ? null : text;
}

export const taskFormSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(1, "กรุณากรอกชื่องาน")
      .max(200, "ชื่องานต้องไม่เกิน 200 ตัวอักษร"),
    description: z.string().nullish(),
    status: z.enum(TaskStatus),
    priority: z.enum(Priority),
    startDate: z.string().trim().regex(ISO_DATE, "รูปแบบวันที่ไม่ถูกต้อง"),
    dueDate: z.string().nullish(),
    // A task can be shared: zero or more people work on it together. Elements
    // are not length-checked here because an empty option value is a normal
    // form artefact; the transform below drops it before it reaches the DB.
    assigneeIds: z.array(z.string()).default([]),
    gameId: z.string().nullish(),
    // Free-text game name, only meaningful when no library game is chosen.
    gameNote: z.string().nullish(),
  })
  .transform((data) => ({
    ...data,
    description: blank(data.description),
    dueDate: blank(data.dueDate),
    gameId: blank(data.gameId),
    // A free-text name is only kept when the task is not tied to a library game.
    gameNote: blank(data.gameId) ? null : blank(data.gameNote),
    // Drop blanks and duplicates so the join table never gets junk rows.
    assigneeIds: [...new Set(data.assigneeIds.filter(Boolean))],
  }))
  .refine(
    (data) => data.description === null || data.description.length <= 2000,
    {
      message: "รายละเอียดต้องไม่เกิน 2000 ตัวอักษร",
      path: ["description"],
    },
  )
  .refine((data) => data.dueDate === null || ISO_DATE.test(data.dueDate), {
    message: "รูปแบบวันที่ไม่ถูกต้อง",
    path: ["dueDate"],
  })
  .refine((data) => !data.dueDate || data.dueDate >= data.startDate, {
    // ISO date strings compare correctly with plain string ordering.
    message: "เดดไลน์ต้องไม่ก่อนวันที่เริ่มงาน",
    path: ["dueDate"],
  });

/**
 * The schema transforms ("" -> null), so the form state and the parsed result
 * have different shapes. `TaskFormValues` is what the inputs hold;
 * `TaskFormInput` is what the server receives.
 */
export type TaskFormValues = z.input<typeof taskFormSchema>;
export type TaskFormInput = z.output<typeof taskFormSchema>;

export const createTaskSchema = taskFormSchema;

export const updateTaskSchema = z.object({
  id: z.string().min(1),
  data: taskFormSchema,
});

/** Drag-and-drop payload: where the card landed. */
export const moveTaskSchema = z.object({
  taskId: z.string().min(1),
  status: z.enum(TaskStatus),
  // Index within the destination column, 0-based.
  toIndex: z.number().int().min(0),
  // Whose board the card was dragged on, so ordering is computed against the
  // same list the user saw. Ignored for members, who only have their own.
  boardUserId: z.string().min(1).nullish(),
});

export type MoveTaskInput = z.infer<typeof moveTaskSchema>;

export const deleteTaskSchema = z.object({ id: z.string().min(1) });
