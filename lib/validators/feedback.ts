import { z } from "zod";
import { FeedbackStatus } from "@prisma/client";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export const feedbackFormSchema = z.object({
  customerName: z
    .string()
    .trim()
    .min(1, "กรุณากรอกชื่อลูกค้า")
    .max(120, "ชื่อลูกค้าต้องไม่เกิน 120 ตัวอักษร"),
  ticketNumber: z
    .string()
    .trim()
    .max(20)
    .nullish()
    .transform((value) => (value ? value : null)),
  reportedAt: z.string().trim().regex(ISO_DATE, "รูปแบบวันที่ไม่ถูกต้อง"),
  gameId: z.string().min(1, "กรุณาเลือกเกม"),
  body: z
    .string()
    .trim()
    .min(1, "กรุณากรอกเนื้อหาฟีดแบค")
    .max(4000, "เนื้อหาต้องไม่เกิน 4000 ตัวอักษร"),
});

export type FeedbackFormValues = z.input<typeof feedbackFormSchema>;
export type FeedbackFormInput = z.output<typeof feedbackFormSchema>;

export const replyFeedbackSchema = z.object({
  id: z.string().min(1),
  status: z.enum(FeedbackStatus),
  replyBody: z
    .string()
    .trim()
    .max(4000)
    .nullish()
    .transform((value) => (value ? value : null)),
  createTask: z.boolean().default(false),
  assigneeId: z
    .string()
    .trim()
    .nullish()
    .transform((value) => (value ? value : null)),
});

export const deleteFeedbackSchema = z.object({ id: z.string().min(1) });

export const gameNameSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "กรุณากรอกชื่อเกม")
    .max(80, "ชื่อเกมต้องไม่เกิน 80 ตัวอักษร"),
});

export const gameIdSchema = z.object({ id: z.string().min(1) });

export const setGameActiveSchema = z.object({
  id: z.string().min(1),
  isActive: z.boolean(),
});

export const renameGameSchema = gameIdSchema.extend(gameNameSchema.shape);
