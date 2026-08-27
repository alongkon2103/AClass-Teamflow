import { z } from "zod";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Shared by the progress composer (client) and the server action. */
export const createProgressSchema = z.object({
  taskId: z.string().min(1),
  entryDate: z.string().trim().regex(ISO_DATE, "รูปแบบวันที่ไม่ถูกต้อง"),
  body: z
    .string()
    .trim()
    .min(1, "กรุณากรอกความคืบหน้า")
    .max(2000, "ความคืบหน้าต้องไม่เกิน 2000 ตัวอักษร"),
  imageUrl: z
    .string()
    .trim()
    .max(2048)
    .nullish()
    .transform((value) => (value ? value : null)),
});

export type CreateProgressInput = z.infer<typeof createProgressSchema>;

export const deleteProgressSchema = z.object({ id: z.string().min(1) });

export const replyProgressSchema = z.object({
  entryId: z.string().min(1),
  body: z
    .string()
    .trim()
    .min(1, "กรุณากรอกข้อความตอบกลับ")
    .max(2000, "ข้อความตอบกลับต้องไม่เกิน 2000 ตัวอักษร"),
});

export const deleteProgressCommentSchema = z.object({
  id: z.string().min(1),
});
