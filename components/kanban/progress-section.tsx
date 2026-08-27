"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Image from "next/image";
import { ImagePlus, MessageSquare, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar } from "@/components/shared/avatar";
import { EmptyState } from "@/components/shared/empty-state";
import { Skeleton } from "@/components/shared/skeleton";
import { formatThaiDate } from "@/lib/format";
import { MAX_IMAGE_BYTES, ALLOWED_IMAGE_TYPES } from "@/lib/storage/limits";
import {
  createProgressAction,
  deleteProgressAction,
  deleteProgressCommentAction,
  loadProgressAction,
  replyProgressAction,
} from "@/server/actions/progress";
import { ImageLightbox } from "./image-lightbox";
import { ProgressReplies } from "./progress-replies";

export type ProgressEntryView = {
  id: string;
  entryDate: string;
  body: string;
  imageUrl: string | null;
  authorId: string;
  author: { id: string; name: string; avatarColor: string };
  canDelete: boolean;
  comments: {
    id: string;
    body: string;
    author: { id: string; name: string; avatarColor: string };
    canDelete: boolean;
  }[];
};

/**
 * Daily progress timeline plus the composer. Submitting saves immediately —
 * it does not wait for the task's own save button (SPEC 5.4).
 */
export function ProgressSection({
  taskId,
  today,
  onSaved,
  canReply,
}: {
  taskId: string;
  today: string;
  onSaved: () => void;
  /** Leaders may answer a member's daily update. */
  canReply: boolean;
}) {
  const [entries, setEntries] = useState<ProgressEntryView[] | null>(null);
  const [body, setBody] = useState("");
  const [entryDate, setEntryDate] = useState(today);
  const [image, setImage] = useState<{ file: File; preview: string } | null>(
    null,
  );
  const [pending, startTransition] = useTransition();
  const [lightbox, setLightbox] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const reload = async () => setEntries(await loadProgressAction(taskId));

  useEffect(() => {
    let cancelled = false;
    setEntries(null);
    loadProgressAction(taskId).then((data) => {
      if (!cancelled) setEntries(data);
    });
    return () => {
      cancelled = true;
    };
  }, [taskId]);

  // Release the object URL when the preview is replaced or cleared.
  useEffect(() => {
    return () => {
      if (image) URL.revokeObjectURL(image.preview);
    };
  }, [image]);

  const pickImage = (file: File | undefined) => {
    if (!file) return;
    if (!(ALLOWED_IMAGE_TYPES as readonly string[]).includes(file.type)) {
      toast.error("รองรับเฉพาะไฟล์ JPG, PNG และ WebP");
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      toast.error("ไฟล์ต้องมีขนาดไม่เกิน 5MB");
      return;
    }
    setImage({ file, preview: URL.createObjectURL(file) });
  };

  /** Ctrl+V straight into the box attaches the pasted screenshot. */
  const onPaste = (event: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const file = Array.from(event.clipboardData.files).find((item) =>
      item.type.startsWith("image/"),
    );
    if (!file) return;
    // Stop the image's placeholder text from also landing in the textarea.
    event.preventDefault();
    pickImage(file);
  };

  const submit = () => {
    if (!body.trim()) {
      toast.error("กรุณากรอกความคืบหน้า");
      return;
    }

    startTransition(async () => {
      let imageUrl: string | null = null;

      if (image) {
        const payload = new FormData();
        payload.append("file", image.file);
        const response = await fetch("/api/upload", {
          method: "POST",
          body: payload,
        });
        const result = await response.json();
        if (!response.ok || !result.ok) {
          toast.error(result.message ?? "อัปโหลดรูปไม่สำเร็จ");
          return;
        }
        imageUrl = result.url as string;
      }

      const result = await createProgressAction({
        taskId,
        entryDate,
        body,
        imageUrl,
      });

      if (!result.ok) {
        toast.error(result.message);
        return;
      }

      toast.success("ส่งความคืบหน้าแล้ว");
      setBody("");
      setImage(null);
      if (fileInput.current) fileInput.current.value = "";
      await reload();
      onSaved();
    });
  };

  const remove = (id: string) => {
    startTransition(async () => {
      const result = await deleteProgressAction({ id });
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      toast.success("ลบความคืบหน้าแล้ว");
      await reload();
      onSaved();
    });
  };

  return (
    <section className="border-line border-t pt-4">
      <h4 className="mb-3 text-sm font-bold">ความคืบหน้ารายวัน</h4>

      {entries === null ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      ) : entries.length === 0 ? (
        <div className="border-line rounded-2xl border border-dashed">
          <EmptyState
            icon={MessageSquare}
            message="ยังไม่มีความคืบหน้า เริ่มบันทึกได้จากช่องด้านล่าง"
          />
        </div>
      ) : (
        <ol className="flex flex-col gap-3">
          {entries.map((entry) => (
            <li key={entry.id} className="bg-hover rounded-xl p-3">
              <div className="flex items-center gap-2">
                <Avatar user={entry.author} size={24} />
                <span className="text-xs font-bold">{entry.author.name}</span>
                <span className="text-muted-foreground text-[11px]">
                  {formatThaiDate(entry.entryDate)}
                </span>
                {entry.canDelete ? (
                  <button
                    type="button"
                    onClick={() => remove(entry.id)}
                    disabled={pending}
                    aria-label={`ลบความคืบหน้าวันที่ ${formatThaiDate(entry.entryDate)}`}
                    className="text-muted-foreground hover:text-danger-ink ml-auto inline-flex size-7 items-center justify-center rounded-lg transition-colors duration-150"
                  >
                    <Trash2 size={14} strokeWidth={2} />
                  </button>
                ) : null}
              </div>
              <p className="mt-2 text-[13px] leading-relaxed whitespace-pre-wrap">
                {entry.body}
              </p>
              {entry.imageUrl ? (
                <button
                  type="button"
                  onClick={() => setLightbox(entry.imageUrl)}
                  aria-label="ดูรูปขนาดเต็ม"
                  className="mt-2 block cursor-zoom-in"
                >
                  <Image
                    src={entry.imageUrl}
                    alt="รูปประกอบความคืบหน้า"
                    width={480}
                    height={320}
                    unoptimized
                    className="border-line h-auto max-h-48 w-auto rounded-xl border object-cover"
                  />
                </button>
              ) : null}

              <ProgressReplies
                comments={entry.comments}
                canReply={canReply}
                pending={pending}
                onReply={(body) =>
                  startTransition(async () => {
                    const result = await replyProgressAction({
                      entryId: entry.id,
                      body,
                    });
                    if (!result.ok) {
                      toast.error(result.message);
                      return;
                    }
                    toast.success("ตอบกลับแล้ว");
                    await reload();
                    onSaved();
                  })
                }
                onDelete={(id) =>
                  startTransition(async () => {
                    const result = await deleteProgressCommentAction({ id });
                    if (!result.ok) {
                      toast.error(result.message);
                      return;
                    }
                    await reload();
                  })
                }
              />
            </li>
          ))}
        </ol>
      )}

      <div className="border-line bg-input-bg mt-3 rounded-xl border p-3">
        <Textarea
          value={body}
          onChange={(event) => setBody(event.target.value)}
          onPaste={onPaste}
          rows={2}
          placeholder="วันนี้ทำอะไรไปบ้าง (วางรูปด้วย Ctrl+V ได้)"
          aria-label="ข้อความความคืบหน้า"
          className="border-none bg-transparent p-0 focus-visible:ring-0"
        />

        {image ? (
          <div className="relative mt-2 inline-block">
            <Image
              src={image.preview}
              alt="ตัวอย่างรูปที่จะแนบ"
              width={160}
              height={120}
              unoptimized
              className="border-line h-auto max-h-24 w-auto rounded-lg border object-cover"
            />
            <button
              type="button"
              onClick={() => setImage(null)}
              aria-label="เอารูปออก"
              className="bg-surface border-line absolute -top-2 -right-2 inline-flex size-6 items-center justify-center rounded-full border"
            >
              <X size={12} strokeWidth={2} />
            </button>
          </div>
        ) : null}

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <label className="text-muted-foreground text-[11px] font-semibold">
            วันที่
            <input
              type="date"
              value={entryDate}
              onChange={(event) => setEntryDate(event.target.value)}
              className="bg-surface border-line text-ink ml-2 rounded-lg border px-2 py-1 text-[11px]"
            />
          </label>

          <input
            ref={fileInput}
            type="file"
            accept={ALLOWED_IMAGE_TYPES.join(",")}
            className="sr-only"
            onChange={(event) => pickImage(event.target.files?.[0])}
          />
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => fileInput.current?.click()}
            disabled={pending}
          >
            <ImagePlus size={14} strokeWidth={2} />
            แนบรูป
          </Button>

          <Button
            type="button"
            size="sm"
            className="ml-auto"
            onClick={submit}
            disabled={pending}
          >
            {pending ? "กำลังส่ง" : "ส่งความคืบหน้า"}
          </Button>
        </div>
      </div>
      <ImageLightbox src={lightbox} onClose={() => setLightbox(null)} />
    </section>
  );
}
