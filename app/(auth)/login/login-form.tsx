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
    <Button type="submit" size="lg" className="mt-1 w-full" disabled={pending}>
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
        <Label
          htmlFor="email"
          className="text-muted-foreground text-xs font-semibold"
        >
          อีเมล
        </Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          placeholder="you@teamflow.app"
          className="bg-input-bg h-11 rounded-xl"
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label
          htmlFor="password"
          className="text-muted-foreground text-xs font-semibold"
        >
          รหัสผ่าน
        </Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="bg-input-bg h-11 rounded-xl"
        />
      </div>

      {state?.message ? (
        <p
          role="alert"
          className="text-danger-ink flex items-center gap-2 rounded-xl px-3 py-2 text-sm"
          style={{
            background:
              "color-mix(in srgb, var(--color-danger) 14%, transparent)",
          }}
        >
          <TriangleAlert size={16} strokeWidth={2} className="shrink-0" />
          {state.message}
        </p>
      ) : null}

      <SubmitButton />
    </form>
  );
}
