"use client";

import { useState } from "react";
import { CornerUpLeft, Trash2 } from "lucide-react";
import { Avatar } from "@/components/shared/avatar";
import { Button } from "@/components/ui/button";
import { RichTextEditor } from "@/components/rich-text/rich-text-editor";
import { RichTextView } from "@/components/rich-text/rich-text-view";
import type { MentionCandidate } from "@/components/rich-text/mention-list";
import { EMPTY_DOC, isEmptyRichText, type RichTextDoc } from "@/lib/rich-text";

type Comment = {
  id: string;
  body: RichTextDoc;
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
  members,
  canReply,
  pending,
  onReply,
  onDelete,
}: {
  comments: Comment[];
  members: MentionCandidate[];
  canReply: boolean;
  pending: boolean;
  onReply: (body: RichTextDoc) => void;
  onDelete: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [body, setBody] = useState<RichTextDoc>(EMPTY_DOC);

  const submit = () => {
    if (isEmptyRichText(body)) return;
    onReply(body);
    setBody(EMPTY_DOC);
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
          <RichTextView doc={comment.body} className="mt-1 text-xs" />
        </div>
      ))}

      {canReply ? (
        open ? (
          <div className="mt-2">
            <RichTextEditor
              value={body}
              onChange={setBody}
              members={members}
              ariaLabel="ข้อความตอบกลับ"
              placeholder="ตอบกลับความคืบหน้านี้"
              minHeight={56}
              className="bg-surface"
            />
            <div className="mt-1.5 flex justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                size="xs"
                onClick={() => {
                  setOpen(false);
                  setBody(EMPTY_DOC);
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
