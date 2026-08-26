import { z } from "zod";
import { LeaveStatus } from "@prisma/client";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export const createLeaveSchema = z
  .object({
    userId: z.string().min(1, "กรุณาเลือกผู้ลา"),
    startDate: z.string().trim().regex(ISO_DATE, "รูปแบบวันที่ไม่ถูกต้อง"),
    endDate: z.string().trim().regex(ISO_DATE, "รูปแบบวันที่ไม่ถูกต้อง"),
    reason: z
      .string()
      .trim()
      .max(500, "เหตุผลต้องไม่เกิน 500 ตัวอักษร")
      .nullish()
      .transform((value) => (value ? value : null)),
  })
  .refine((data) => data.endDate >= data.startDate, {
    message: "วันสิ้นสุดต้องไม่ก่อนวันเริ่มลา",
    path: ["endDate"],
  });

export type CreateLeaveValues = z.input<typeof createLeaveSchema>;
export type CreateLeaveInput = z.output<typeof createLeaveSchema>;

export const decideLeaveSchema = z.object({
  id: z.string().min(1),
  status: z.enum([LeaveStatus.APPROVED, LeaveStatus.REJECTED]),
});

export const cancelLeaveSchema = z.object({ id: z.string().min(1) });
