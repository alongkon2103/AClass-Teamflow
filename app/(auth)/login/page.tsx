import type { Metadata } from "next";
import { Columns3 } from "lucide-react";
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
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <span className="bg-primary text-primary-foreground flex size-11 items-center justify-center rounded-2xl">
            <Columns3 size={21} strokeWidth={2} />
          </span>
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight">TeamFlow</h1>
            <p className="text-muted-foreground mt-1 text-sm">
              เข้าสู่ระบบเพื่อจัดการงานของทีม
            </p>
          </div>
        </div>

        <div className="bg-card rounded-[18px] border p-6 shadow-sm">
          <LoginForm callbackUrl={callbackUrl} />
        </div>
      </div>
    </main>
  );
}
