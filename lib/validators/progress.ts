import { z } from "zod";
import { isEmptyRichText, richTextSchema } from "@/lib/rich-text";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Upper bound per update, so one entry cannot flood the timeline. */
export const MAX_PROGRESS_IMAGES = 10;

/** Shared by the progress composer (client) and the server action. */
export const createProgressSchema = z.object({
  taskId: z.string().min(1),
  entryDate: z.string().trim().regex(ISO_DATE, "รูปแบบวันที่ไม่ถูกต้อง"),
  body: richTextSchema.refine(
    (doc) => !isEmptyRichText(doc),
    "กรุณากรอกความคืบหน้า",
  ),
  imageUrls: z
    .array(z.string().trim().max(2048))
    .max(MAX_PROGRESS_IMAGES, `แนบรูปได้ไม่เกิน ${MAX_PROGRESS_IMAGES} รูป`)
    .default([])
    // Blanks would render as broken images, so they never reach the database.
    .transform((urls) => urls.filter(Boolean)),
});

export type CreateProgressInput = z.infer<typeof createProgressSchema>;

export const deleteProgressSchema = z.object({ id: z.string().min(1) });

export const replyProgressSchema = z.object({
  entryId: z.string().min(1),
  body: richTextSchema.refine(
    (doc) => !isEmptyRichText(doc),
    "กรุณากรอกข้อความตอบกลับ",
  ),
});

export const deleteProgressCommentSchema = z.object({
  id: z.string().min(1),
});
