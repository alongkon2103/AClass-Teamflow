import { z } from "zod";
import { Role } from "@prisma/client";

const optionalText = z
  .string()
  .trim()
  .max(80)
  .nullish()
  .transform((value) => (value ? value : null));

export const createMemberSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "กรุณากรอกชื่อ")
    .max(80, "ชื่อต้องไม่เกิน 80 ตัวอักษร"),
  email: z
    .string()
    .trim()
    .min(1, "กรุณากรอกอีเมล")
    .email("รูปแบบอีเมลไม่ถูกต้อง")
    .transform((value) => value.toLowerCase()),
  jobTitle: optionalText,
  role: z.enum(Role),
  temporaryPassword: z
    .string()
    .min(8, "รหัสผ่านชั่วคราวต้องมีอย่างน้อย 8 ตัวอักษร")
    .max(72, "รหัสผ่านต้องไม่เกิน 72 ตัวอักษร"),
});

export type CreateMemberValues = z.input<typeof createMemberSchema>;
export type CreateMemberInput = z.output<typeof createMemberSchema>;

export const updateMemberSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1, "กรุณากรอกชื่อ").max(80),
  jobTitle: optionalText,
  role: z.enum(Role),
});

export const setMemberActiveSchema = z.object({
  id: z.string().min(1),
  isActive: z.boolean(),
});

export const resetPasswordSchema = z.object({
  id: z.string().min(1),
  temporaryPassword: z
    .string()
    .min(8, "รหัสผ่านชั่วคราวต้องมีอย่างน้อย 8 ตัวอักษร")
    .max(72),
});
