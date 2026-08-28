import { z } from "zod";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export const meetingFormSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "กรุณากรอกหัวข้อการประชุม")
    .max(200, "หัวข้อต้องไม่เกิน 200 ตัวอักษร"),
  meetingAt: z.string().trim().regex(ISO_DATE, "รูปแบบวันที่ไม่ถูกต้อง"),
  summary: z
    .string()
    .trim()
    .min(1, "กรุณากรอกสรุปผลการประชุม")
    .max(20000, "สรุปผลต้องไม่เกิน 20000 ตัวอักษร"),
});

export type MeetingFormValues = z.input<typeof meetingFormSchema>;
export type MeetingFormInput = z.output<typeof meetingFormSchema>;

export const updateMeetingSchema = z.object({
  id: z.string().min(1),
  data: meetingFormSchema,
});

export const deleteMeetingSchema = z.object({ id: z.string().min(1) });
