"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  changePasswordSchema,
  type ChangePasswordInput,
} from "@/lib/validators/auth";
import { changePasswordAction } from "@/server/actions/member";

const labelClass = "text-muted-foreground text-xs font-semibold";
const fieldClass = "bg-input-bg h-11 rounded-xl";

export function ChangePasswordForm({ forced }: { forced: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const form = useForm<ChangePasswordInput>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    },
  });

  const onSubmit = form.handleSubmit((values) => {
    startTransition(async () => {
      const result = await changePasswordAction(values);
      if (result.ok) {
        toast.success("เปลี่ยนรหัสผ่านแล้ว");
        form.reset();
        router.refresh();
      } else {
        toast.error(result.message);
      }
    });
  });

  const errors = form.formState.errors;

  return (
    <form
      onSubmit={onSubmit}
      className="border-line bg-surface flex max-w-md flex-col gap-4 rounded-[18px] border p-5 shadow-sm"
    >
      {forced ? (
        <p
          role="alert"
          className="text-doing-ink rounded-xl px-3 py-2 text-sm"
          style={{
            background:
              "color-mix(in srgb, var(--color-doing) 14%, transparent)",
          }}
        >
          บัญชีนี้ใช้รหัสผ่านชั่วคราว กรุณาตั้งรหัสผ่านใหม่ก่อนใช้งาน
        </p>
      ) : null}

      <div className="flex flex-col gap-2">
        <Label htmlFor="currentPassword" className={labelClass}>
          รหัสผ่านปัจจุบัน
        </Label>
        <Input
          id="currentPassword"
          type="password"
          autoComplete="current-password"
          className={fieldClass}
          {...form.register("currentPassword")}
        />
        {errors.currentPassword ? (
          <p className="text-danger-ink text-xs">
            {errors.currentPassword.message}
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="newPassword" className={labelClass}>
          รหัสผ่านใหม่
        </Label>
        <Input
          id="newPassword"
          type="password"
          autoComplete="new-password"
          className={fieldClass}
          {...form.register("newPassword")}
        />
        {errors.newPassword ? (
          <p className="text-danger-ink text-xs">
            {errors.newPassword.message}
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="confirmPassword" className={labelClass}>
          ยืนยันรหัสผ่านใหม่
        </Label>
        <Input
          id="confirmPassword"
          type="password"
          autoComplete="new-password"
          className={fieldClass}
          {...form.register("confirmPassword")}
        />
        {errors.confirmPassword ? (
          <p className="text-danger-ink text-xs">
            {errors.confirmPassword.message}
          </p>
        ) : null}
      </div>

      <Button type="submit" disabled={pending}>
        <KeyRound size={16} strokeWidth={2} />
        {pending ? "กำลังบันทึก" : "เปลี่ยนรหัสผ่าน"}
      </Button>
    </form>
  );
}
