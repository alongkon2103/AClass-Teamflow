"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { LogIn, TriangleAlert } from "lucide-react";
import { loginAction, type ActionResult } from "@/server/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" className="w-full" disabled={pending}>
      <LogIn size={16} strokeWidth={2} />
      {pending ? "กำลังเข้าสู่ระบบ" : "เข้าสู่ระบบ"}
    </Button>
  );
}

export function LoginForm({ callbackUrl }: { callbackUrl?: string }) {
  const [state, formAction] = useActionState<
    ActionResult | undefined,
    FormData
  >(loginAction, undefined);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {callbackUrl ? (
        <input type="hidden" name="callbackUrl" value={callbackUrl} />
      ) : null}

      <div className="flex flex-col gap-2">
        <Label htmlFor="email">อีเมล</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          placeholder="you@teamflow.app"
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="password">รหัสผ่าน</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />
      </div>

      {state?.message ? (
        <p
          role="alert"
          className="bg-destructive/10 text-destructive flex items-center gap-2 rounded-xl px-3 py-2 text-sm"
        >
          <TriangleAlert size={16} strokeWidth={2} />
          {state.message}
        </p>
      ) : null}

      <SubmitButton />
    </form>
  );
}
