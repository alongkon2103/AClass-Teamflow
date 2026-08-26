import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";

export default async function BoardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <section>
      <h1 className="text-[25px] font-extrabold tracking-tight">บอร์ดงาน</h1>
      <p className="text-muted-foreground mt-1 text-sm">
        ติดตามและอัปเดตสถานะงานที่รับผิดชอบ
      </p>
      <p className="text-muted-foreground mt-6 text-sm">
        เนื้อหาส่วนนี้จะถูกสร้างใน Phase 4
      </p>
    </section>
  );
}
