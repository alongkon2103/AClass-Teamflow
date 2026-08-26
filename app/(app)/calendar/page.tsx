import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { can } from "@/lib/permissions";
import { formatCalendarDate, todayInBangkok } from "@/lib/date";
import { loadCalendarMonth } from "@/server/services/calendar";
import { listPendingLeaves } from "@/server/services/leave";
import { PageHeader } from "@/components/shared/page-header";
import { CalendarView } from "@/components/calendar/calendar-view";
import { LeaveDialog } from "@/components/calendar/leave-dialog";
import { PendingLeaves } from "@/components/calendar/pending-leaves";
import type { MemberOption } from "@/components/kanban/types";

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; month?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const actor = { id: user.id, role: user.role };
  const canDecide = can(actor, { type: "leave:decide" });

  const today = formatCalendarDate(todayInBangkok());
  const params = await searchParams;

  // Fall back to the current month when the query string is missing or junk.
  const parsedYear = Number.parseInt(params.year ?? "", 10);
  const parsedMonth = Number.parseInt(params.month ?? "", 10);
  const [todayYear, todayMonth] = today.split("-").map(Number);
  const year =
    Number.isFinite(parsedYear) && parsedYear >= 1970 && parsedYear <= 9999
      ? parsedYear
      : todayYear;
  const month =
    Number.isFinite(parsedMonth) && parsedMonth >= 1 && parsedMonth <= 12
      ? parsedMonth
      : todayMonth;

  const [data, pendingLeaves, members] = await Promise.all([
    loadCalendarMonth(db, actor, year, month),
    canDecide ? listPendingLeaves(db) : Promise.resolve([]),
    canDecide
      ? db.user.findMany({
          where: { isActive: true },
          select: { id: true, name: true, jobTitle: true, avatarColor: true },
          orderBy: { name: "asc" },
        })
      : Promise.resolve([]),
  ]);

  const self: MemberOption = {
    id: user.id,
    name: user.name,
    jobTitle: user.jobTitle,
    avatarColor: user.avatarColor,
  };

  return (
    <>
      <PageHeader
        title="ปฏิทินทีม"
        description="ความคืบหน้ารายวัน งานที่ครบกำหนด และวันลาของทีม"
        action={
          <LeaveDialog
            self={self}
            members={members.length > 0 ? members : [self]}
            canChooseUser={canDecide}
            today={today}
          />
        }
      />

      {canDecide ? (
        <PendingLeaves
          leaves={pendingLeaves.map((leave) => ({
            id: leave.id,
            startDate: formatCalendarDate(leave.startDate),
            endDate: formatCalendarDate(leave.endDate),
            reason: leave.reason,
            user: leave.user,
          }))}
        />
      ) : null}

      <CalendarView year={year} month={month} data={data} today={today} />
    </>
  );
}
