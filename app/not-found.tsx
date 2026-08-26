import Link from "next/link";
import { Search } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
      <Search size={32} strokeWidth={2} className="text-muted-foreground" />
      <div>
        <h1 className="text-xl font-bold">ไม่พบหน้าที่ต้องการ</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          หน้านี้อาจถูกย้ายหรือลบไปแล้ว
        </p>
      </div>
      <Link href="/" className={buttonVariants({ size: "lg" })}>
        กลับหน้าหลัก
      </Link>
    </main>
  );
}
