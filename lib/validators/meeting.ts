import { z } from "zod";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
/** 24-hour "HH:mm", which is what <input type="time"> submits. */
const CLOCK_TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

/** "" / null / undefined all mean "not given". */
const blankable = z
  .union([z.string(), z.null()])
  .optional()
  .transform((value) => {
    const text = (value ?? "").trim();
    return text === "" ? null : text;
  });

export const meetingFormSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "กรุณากรอกหัวข้อการประชุม")
    .max(200, "หัวข้อต้องไม่เกิน 200 ตัวอักษร"),
  meetingAt: z.string().trim().regex(ISO_DATE, "รูปแบบวันที่ไม่ถูกต้อง"),
  startTime: blankable.refine(
    (value) => value === null || CLOCK_TIME.test(value),
    "รูปแบบเวลาไม่ถูกต้อง",
  ),
  description: blankable.refine(
    (value) => value === null || value.length <= 5000,
    "รายละเอียดต้องไม่เกิน 5000 ตัวอักษร",
  ),
  // Written after the meeting, so a booking can be saved without it.
  summary: blankable.refine(
    (value) => value === null || value.length <= 20000,
    "สรุปผลต้องไม่เกิน 20000 ตัวอักษร",
  ),
});

export type MeetingFormValues = z.input<typeof meetingFormSchema>;
export type MeetingFormInput = z.output<typeof meetingFormSchema>;

export const updateMeetingSchema = z.object({
  id: z.string().min(1),
  data: meetingFormSchema,
});

export const deleteMeetingSchema = z.object({ id: z.string().min(1) });
