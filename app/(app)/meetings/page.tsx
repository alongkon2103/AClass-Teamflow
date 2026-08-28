import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
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

  const rows = await listMeetings(db);

  return (
    <>
      <PageHeader
        title="รายการประชุม"
        description="บันทึกสรุปผลการประชุมและย้อนดูประวัติที่ผ่านมา"
      />

      <MeetingBoard
        canManage={canManage}
        today={formatCalendarDate(todayInBangkok())}
        meetings={rows.map((row) => ({
          id: row.id,
          title: row.title,
          meetingAt: formatCalendarDate(row.meetingAt),
          summary: row.summary,
          createdBy: row.createdBy,
        }))}
      />
    </>
  );
}
