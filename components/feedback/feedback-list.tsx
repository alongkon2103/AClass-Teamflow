"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { MessageSquare } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { deleteFeedbackAction } from "@/server/actions/feedback";
import { FeedbackCard, type FeedbackView } from "./feedback-card";
import type { MemberOption } from "@/components/kanban/types";

export function FeedbackList({
  items,
  canReply,
  members,
}: {
  items: FeedbackView[];
  canReply: boolean;
  members: MemberOption[];
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  const remove = (id: string) => {
    startTransition(async () => {
      const result = await deleteFeedbackAction({ id });
      if (result.ok) {
        toast.success("ลบฟีดแบคแล้ว");
        router.refresh();
      } else {
        toast.error(result.message);
      }
    });
  };

  if (items.length === 0) {
    return (
      <div className="border-line bg-surface rounded-[18px] border">
        <EmptyState
          icon={MessageSquare}
          message="ยังไม่มีฟีดแบคที่ตรงกับเงื่อนไข"
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {items.map((item) => (
        <FeedbackCard
          key={item.id}
          feedback={item}
          canReply={canReply}
          members={members}
          onDelete={remove}
        />
      ))}
    </div>
  );
}
