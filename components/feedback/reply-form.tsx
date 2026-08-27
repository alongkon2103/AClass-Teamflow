"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { FeedbackStatus } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { FEEDBACK_STATUS_META } from "@/lib/constants";
import { replyFeedbackAction } from "@/server/actions/feedback";
import type { MemberOption } from "@/components/kanban/types";
import type { FeedbackView } from "./feedback-card";

const STATUS_ORDER: FeedbackStatus[] = [
  FeedbackStatus.PENDING,
  FeedbackStatus.FIXING,
  FeedbackStatus.RESOLVED,
  FeedbackStatus.DISMISSED,
];

/** Leader-only reply: pick a decision, explain it, optionally spin up a task. */
export function ReplyForm({
  feedback,
  members,
  onDone,
}: {
  feedback: FeedbackView;
  members: MemberOption[];
  onDone: () => void;
}) {
  const [status, setStatus] = useState<FeedbackStatus>(feedback.status);
  const [replyBody, setReplyBody] = useState(feedback.replyBody ?? "");
  const [createTask, setCreateTask] = useState(false);
  const [assigneeId, setAssigneeId] = useState("");
  const [pending, startTransition] = useTransition();

  const submit = () => {
    startTransition(async () => {
      const result = await replyFeedbackAction({
        id: feedback.id,
        status,
        replyBody,
        createTask,
        assigneeId: assigneeId || null,
      });
      if (result.ok) {
        toast.success("บันทึกการตอบกลับแล้ว");
        onDone();
      } else {
        toast.error(result.message);
      }
    });
  };

  return (
    <div className="border-line mt-4 border-t pt-4">
      <p className="text-muted-foreground mb-2 text-xs font-semibold">
        การตอบกลับของทีม
      </p>

      <div
        className="mb-3 flex flex-wrap gap-2"
        role="radiogroup"
        aria-label="สถานะฟีดแบค"
      >
        {STATUS_ORDER.map((option) => {
          const meta = FEEDBACK_STATUS_META[option];
          const selected = status === option;
          return (
            <button
              key={option}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => setStatus(option)}
              className="rounded-xl border px-3 py-2 text-xs font-bold transition-colors duration-150"
              style={
                selected
                  ? {
                      color: meta.ink,
                      borderColor: meta.mark,
                      background: `color-mix(in srgb, ${meta.mark} 16%, transparent)`,
                    }
                  : { color: "var(--muted)", borderColor: "var(--line)" }
              }
            >
              {meta.label}
            </button>
          );
        })}
      </div>

      <Textarea
        value={replyBody}
        onChange={(event) => setReplyBody(event.target.value)}
        rows={3}
        placeholder="เหตุผลหรือรายละเอียดการตอบกลับ"
        aria-label="ข้อความตอบกลับ"
        className="bg-input-bg rounded-xl"
      />

      {status === FeedbackStatus.FIXING && !feedback.linkedTaskId ? (
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <label className="inline-flex items-center gap-2 text-xs font-semibold">
            <input
              type="checkbox"
              checked={createTask}
              onChange={(event) => setCreateTask(event.target.checked)}
              className="size-4 rounded"
            />
            สร้างเป็นงานในบอร์ด
          </label>

          {createTask ? (
            <select
              value={assigneeId}
              onChange={(event) => setAssigneeId(event.target.value)}
              aria-label="ผู้รับผิดชอบงานที่สร้าง"
              className="bg-input-bg border-line text-ink h-9 rounded-xl border px-2 text-xs"
            >
              <option value="">ยังไม่กำหนดผู้รับผิดชอบ</option>
              {members.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.name}
                </option>
              ))}
            </select>
          ) : null}
        </div>
      ) : null}

      <div className="mt-3 flex justify-end gap-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onDone}
          disabled={pending}
        >
          ยกเลิก
        </Button>
        <Button type="button" size="sm" onClick={submit} disabled={pending}>
          {pending ? "กำลังบันทึก" : "บันทึกการตอบกลับ"}
        </Button>
      </div>
    </div>
  );
}
