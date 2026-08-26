import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { can } from "@/lib/permissions";
import { formatCalendarDate, todayInBangkok } from "@/lib/date";
import { toCalendarString } from "@/lib/format";
import {
  listFeedback,
  parseFeedbackFilters,
  formatTicketNumber,
  highestSequence,
} from "@/server/services/feedback";
import { PageHeader } from "@/components/shared/page-header";
import { FeedbackList } from "@/components/feedback/feedback-list";
import { FeedbackFilters } from "@/components/feedback/feedback-filters";
import { FeedbackDialog } from "@/components/feedback/feedback-dialog";
import type { FeedbackView } from "@/components/feedback/feedback-card";

export default async function FeedbackPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; game?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const actor = { id: user.id, role: user.role };
  const canReply = can(actor, { type: "feedback:reply" });
  const filters = parseFeedbackFilters(await searchParams);

  const [rows, games, members, ticketNumbers] = await Promise.all([
    listFeedback(db, filters),
    db.game.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    canReply
      ? db.user.findMany({
          where: { isActive: true },
          select: { id: true, name: true, jobTitle: true, avatarColor: true },
          orderBy: { name: "asc" },
        })
      : Promise.resolve([]),
    db.feedback.findMany({ select: { ticketNumber: true } }),
  ]);

  const items: FeedbackView[] = rows.map((row) => ({
    id: row.id,
    ticketNumber: row.ticketNumber,
    customerName: row.customerName,
    reportedAt: formatCalendarDate(row.reportedAt),
    body: row.body,
    status: row.status,
    replyBody: row.replyBody,
    repliedAt: toCalendarString(row.repliedAt),
    linkedTaskId: row.linkedTaskId,
    game: row.game,
    repliedBy: row.repliedBy,
  }));

  // Only a suggestion for the form; the server allocates the real number.
  const suggestedTicket = formatTicketNumber(
    highestSequence(ticketNumbers.map((row) => row.ticketNumber)) + 1,
  );

  return (
    <>
      <PageHeader
        title="Customer Feedback"
        description="รวบรวมฟีดแบคจากลูกค้า ระบุ Ticket และบันทึกการตอบกลับของทีม"
        action={
          <FeedbackDialog
            games={games}
            suggestedTicket={suggestedTicket}
            today={formatCalendarDate(todayInBangkok())}
          />
        }
      />

      <div className="mb-4">
        <Suspense fallback={null}>
          <FeedbackFilters games={games} />
        </Suspense>
      </div>

      <FeedbackList items={items} canReply={canReply} members={members} />
    </>
  );
}
