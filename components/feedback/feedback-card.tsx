"use client";

import Link from "next/link";
import { useState } from "react";
import {
  CornerUpLeft,
  Gamepad2,
  MessageSquare,
  Pencil,
  Ticket,
  Trash2,
} from "lucide-react";
import type { FeedbackStatus } from "@prisma/client";
import { FeedbackStatusBadge } from "@/components/shared/badges";
import { FEEDBACK_STATUS_META } from "@/lib/constants";
import { formatThaiDate } from "@/lib/format";
import { ReplyForm } from "./reply-form";
import type { MemberOption } from "@/components/kanban/types";

export type FeedbackView = {
  id: string;
  ticketNumber: string;
  customerName: string;
  reportedAt: string;
  body: string;
  status: FeedbackStatus;
  replyBody: string | null;
  repliedAt: string | null;
  linkedTaskId: string | null;
  game: { id: string; name: string } | null;
  repliedBy: { name: string; avatarColor: string } | null;
};

export function FeedbackCard({
  feedback,
  canReply,
  members,
  onDelete,
}: {
  feedback: FeedbackView;
  canReply: boolean;
  members: MemberOption[];
  onDelete: (id: string) => void;
}) {
  const [replying, setReplying] = useState(false);
  const meta = FEEDBACK_STATUS_META[feedback.status];

  return (
    <article className="border-line bg-surface rounded-[18px] border p-5 shadow-sm">
      <div className="flex items-start gap-4">
        <span
          aria-hidden="true"
          className="bg-primary-soft text-primary-ink flex size-11 shrink-0 items-center justify-center rounded-xl"
        >
          <MessageSquare size={20} strokeWidth={2} />
        </span>

        <div className="min-w-0 flex-1">
          <div className="mb-1.5 flex flex-wrap items-center gap-2">
            <span className="text-[15px] font-bold">
              {feedback.customerName}
            </span>
            <span className="bg-hover text-muted-foreground inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold">
              <Ticket size={12} strokeWidth={2} />
              {feedback.ticketNumber}
            </span>
            <FeedbackStatusBadge status={feedback.status} />
            <span className="text-muted-foreground ml-auto text-xs">
              {formatThaiDate(feedback.reportedAt)}
            </span>
          </div>

          <span className="text-primary-ink mb-2 inline-flex items-center gap-1.5 text-xs font-semibold">
            <Gamepad2 size={14} strokeWidth={2} />
            {feedback.game?.name ?? "ไม่ระบุเกม"}
          </span>

          <p className="text-[13.5px] leading-relaxed whitespace-pre-wrap">
            {feedback.body}
          </p>

          {feedback.replyBody ? (
            <div
              className="bg-hover mt-3 rounded-xl p-3"
              style={{ borderLeft: `3px solid ${meta.mark}` }}
            >
              <span
                className="mb-1 inline-flex items-center gap-1.5 text-[11px] font-bold"
                style={{ color: meta.ink }}
              >
                <CornerUpLeft size={13} strokeWidth={2} />
                การตอบกลับของทีม
              </span>
              <p className="text-[13px] leading-relaxed whitespace-pre-wrap">
                {feedback.replyBody}
              </p>
              <p className="text-muted-foreground mt-1.5 text-[11px]">
                {feedback.repliedBy?.name ?? "ทีมงาน"}
                {feedback.repliedAt
                  ? ` · ${formatThaiDate(feedback.repliedAt)}`
                  : ""}
              </p>
            </div>
          ) : null}

          {feedback.linkedTaskId ? (
            <Link
              href={`/board?task=${feedback.linkedTaskId}`}
              className="text-primary-ink mt-2 inline-block text-xs font-semibold"
            >
              ดูงานที่ผูกกับ Ticket นี้
            </Link>
          ) : null}

          {canReply && replying ? (
            <ReplyForm
              feedback={feedback}
              members={members}
              onDone={() => setReplying(false)}
            />
          ) : null}
        </div>

        {canReply ? (
          <div className="flex shrink-0 flex-col gap-1">
            <button
              type="button"
              onClick={() => setReplying((value) => !value)}
              aria-label={`ตอบกลับ ${feedback.ticketNumber}`}
              title="ตอบกลับ"
              className="border-line hover:bg-hover inline-flex size-8 items-center justify-center rounded-lg border"
            >
              <Pencil size={14} strokeWidth={2} />
            </button>
            <button
              type="button"
              onClick={() => onDelete(feedback.id)}
              aria-label={`ลบ ${feedback.ticketNumber}`}
              title="ลบ"
              className="border-line hover:bg-hover hover:text-danger-ink inline-flex size-8 items-center justify-center rounded-lg border"
            >
              <Trash2 size={14} strokeWidth={2} />
            </button>
          </div>
        ) : null}
      </div>
    </article>
  );
}
