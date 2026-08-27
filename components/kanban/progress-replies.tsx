"use client";

import { useState } from "react";
import { CornerUpLeft, Trash2 } from "lucide-react";
import { Avatar } from "@/components/shared/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

type Comment = {
  id: string;
  body: string;
  author: { id: string; name: string; avatarColor: string };
  canDelete: boolean;
};

/**
 * Replies under one daily update. The composer is leader-only, but existing
 * replies are visible to everyone who can see the entry, so the member sees the
 * answer to their own update.
 */
export function ProgressReplies({
  comments,
  canReply,
  pending,
  onReply,
  onDelete,
}: {
  comments: Comment[];
  canReply: boolean;
  pending: boolean;
  onReply: (body: string) => void;
  onDelete: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [body, setBody] = useState("");

  const submit = () => {
    if (!body.trim()) return;
    onReply(body.trim());
    setBody("");
    setOpen(false);
  };

  if (comments.length === 0 && !canReply) return null;

  return (
    <div className="border-line/70 mt-2.5 border-l-2 pl-3">
      {comments.map((comment) => (
        <div key={comment.id} className="mt-2 first:mt-0">
          <div className="flex items-center gap-2">
            <Avatar user={comment.author} size={20} />
            <span className="text-[11px] font-bold">{comment.author.name}</span>
            <span className="text-primary-ink inline-flex items-center gap-1 text-[10px] font-semibold">
              <CornerUpLeft size={11} strokeWidth={2} />
              ตอบกลับ
            </span>
            {comment.canDelete ? (
              <button
                type="button"
                onClick={() => onDelete(comment.id)}
                disabled={pending}
                aria-label={`ลบข้อความตอบกลับของ ${comment.author.name}`}
                className="text-muted-foreground hover:text-danger-ink ml-auto inline-flex size-6 items-center justify-center rounded-md"
              >
                <Trash2 size={12} strokeWidth={2} />
              </button>
            ) : null}
          </div>
          <p className="mt-1 text-xs leading-relaxed whitespace-pre-wrap">
            {comment.body}
          </p>
        </div>
      ))}

      {canReply ? (
        open ? (
          <div className="mt-2">
            <Textarea
              value={body}
              onChange={(event) => setBody(event.target.value)}
              rows={2}
              autoFocus
              placeholder="ตอบกลับความคืบหน้านี้"
              aria-label="ข้อความตอบกลับ"
              className="bg-surface rounded-lg text-xs"
            />
            <div className="mt-1.5 flex justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                size="xs"
                onClick={() => {
                  setOpen(false);
                  setBody("");
                }}
              >
                ยกเลิก
              </Button>
              <Button
                type="button"
                size="xs"
                onClick={submit}
                disabled={pending}
              >
                ส่งคำตอบ
              </Button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="text-primary-ink mt-2 inline-flex items-center gap-1 text-[11px] font-semibold"
          >
            <CornerUpLeft size={12} strokeWidth={2} />
            ตอบกลับ
          </button>
        )
      ) : null}
    </div>
  );
}
