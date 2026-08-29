import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import type { RichTextDoc } from "@/lib/rich-text";
import { can } from "@/lib/permissions";
import { formatCalendarDate, todayInBangkok } from "@/lib/date";
import { listMeetings } from "@/server/services/meeting";
import { PageHeader } from "@/components/shared/page-header";
import { MeetingBoard } from "@/components/meeting/meeting-board";

export default async function MeetingsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const actor = { id: user.id, role: user.role };
  // Everyone reads the minutes; only a leader records them.
  const canManage = can(actor, { type: "meeting:manage" });

  const [rows, members] = await Promise.all([
    listMeetings(db),
    db.user.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        jobTitle: true,
        avatarColor: true,
        avatarUrl: true,
      },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <>
      <PageHeader
        title="รายการประชุม"
        description="นัดประชุม บันทึกสรุปผล และย้อนดูประวัติที่ผ่านมา"
      />

      <MeetingBoard
        members={members}
        canManage={canManage}
        today={formatCalendarDate(todayInBangkok())}
        meetings={rows.map((row) => ({
          id: row.id,
          title: row.title,
          meetingAt: formatCalendarDate(row.meetingAt),
          startTime: row.startTime,
          description: (row.description ?? null) as RichTextDoc | null,
          summary: (row.summary ?? null) as RichTextDoc | null,
          createdBy: row.createdBy,
        }))}
      />
    </>
  );
}
