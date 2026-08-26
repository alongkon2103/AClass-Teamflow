import type { Metadata } from "next";
import { Logo } from "@/components/shared/logo";
import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "เข้าสู่ระบบ | TeamFlow",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>;
}) {
  const { callbackUrl } = await searchParams;

  return (
    <main className="flex min-h-dvh items-center justify-center px-6 py-12">
      <div className="border-line bg-surface w-full max-w-[420px] rounded-3xl border p-8 shadow-sm">
        <div className="mb-6 flex items-center gap-3">
          <Logo size={44} />
          <div>
            <div className="text-[22px] leading-tight font-extrabold tracking-tight">
              TeamFlow
            </div>
            <div className="text-muted-foreground text-xs">
              ระบบจัดการงานของทีม
            </div>
          </div>
        </div>

        <LoginForm callbackUrl={callbackUrl} />
      </div>
    </main>
  );
}
