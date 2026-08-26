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
    assigneeId: z.string().nullish(),
    gameId: z.string().nullish(),
  })
  .transform((data) => ({
    ...data,
    description: blank(data.description),
    dueDate: blank(data.dueDate),
    assigneeId: blank(data.assigneeId),
    gameId: blank(data.gameId),
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
});

export type MoveTaskInput = z.infer<typeof moveTaskSchema>;

export const deleteTaskSchema = z.object({ id: z.string().min(1) });
