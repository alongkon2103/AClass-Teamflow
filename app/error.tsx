"use client";

import { useEffect } from "react";
import { TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Server-side details stay on the server; log only what is safe to surface.
    console.error(error);
  }, [error]);

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
      <TriangleAlert
        size={32}
        strokeWidth={2}
        className="text-muted-foreground"
      />
      <div>
        <h1 className="text-xl font-bold">เกิดข้อผิดพลาด</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          ระบบทำงานผิดพลาด กรุณาลองใหม่อีกครั้ง
        </p>
      </div>
      <Button onClick={reset}>ลองใหม่</Button>
    </main>
  );
}
