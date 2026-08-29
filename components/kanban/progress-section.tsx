"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Image from "next/image";
import { ImagePlus, MessageSquare, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { RichTextEditor } from "@/components/rich-text/rich-text-editor";
import { RichTextView } from "@/components/rich-text/rich-text-view";
import type { MentionCandidate } from "@/components/rich-text/mention-list";
import { EMPTY_DOC, isEmptyRichText, type RichTextDoc } from "@/lib/rich-text";
import { Avatar } from "@/components/shared/avatar";
import { EmptyState } from "@/components/shared/empty-state";
import { Skeleton } from "@/components/shared/skeleton";
import { formatThaiDate } from "@/lib/format";
import { MAX_IMAGE_BYTES, ALLOWED_IMAGE_TYPES } from "@/lib/storage/limits";
import { MAX_PROGRESS_IMAGES } from "@/lib/validators/progress";
import {
  createProgressAction,
  deleteProgressAction,
  deleteProgressCommentAction,
  loadProgressAction,
  replyProgressAction,
} from "@/server/actions/progress";
import { ImageLightbox, type LightboxState } from "./image-lightbox";
import { ProgressReplies } from "./progress-replies";

export type ProgressEntryView = {
  id: string;
  entryDate: string;
  body: RichTextDoc;
  imageUrls: string[];
  authorId: string;
  author: { id: string; name: string; avatarColor: string };
  canDelete: boolean;
  comments: {
    id: string;
    body: RichTextDoc;
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
  members,
}: {
  taskId: string;
  today: string;
  onSaved: () => void;
  /** Leaders may answer a member's daily update. */
  canReply: boolean;
  /** People who can be @-mentioned in an update or a reply. */
  members: MentionCandidate[];
}) {
  const [entries, setEntries] = useState<ProgressEntryView[] | null>(null);
  const [body, setBody] = useState<RichTextDoc>(EMPTY_DOC);
  const [entryDate, setEntryDate] = useState(today);
  const [images, setImages] = useState<{ file: File; preview: string }[]>([]);
  const [pending, startTransition] = useTransition();
  const [uploading, setUploading] = useState<{
    done: number;
    total: number;
  } | null>(null);
  const [lightbox, setLightbox] = useState<LightboxState>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const reload = async () => setEntries(await loadProgressAction(taskId));

  // Kept in a ref so the unmount cleanup sees the latest list without
  // re-running (and revoking live previews) on every change.
  const imagesRef = useRef<{ file: File; preview: string }[]>([]);
  imagesRef.current = images;

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

  // Revoke every preview URL when the composer unmounts. Removing one
  // attachment revokes that one directly, so nothing leaks either way.
  useEffect(() => {
    return () => {
      for (const item of imagesRef.current) URL.revokeObjectURL(item.preview);
    };
  }, []);

  /** Adds whatever is valid and says once what was skipped and why. */
  const addImages = (incoming: File[]) => {
    if (incoming.length === 0) return;

    const accepted: { file: File; preview: string }[] = [];
    let wrongType = 0;
    let tooBig = 0;

    for (const file of incoming) {
      if (!(ALLOWED_IMAGE_TYPES as readonly string[]).includes(file.type)) {
        wrongType += 1;
        continue;
      }
      if (file.size > MAX_IMAGE_BYTES) {
        tooBig += 1;
        continue;
      }
      accepted.push({ file, preview: URL.createObjectURL(file) });
    }

    if (wrongType > 0) {
      toast.error(`ข้าม ${wrongType} ไฟล์ที่ไม่ใช่ JPG, PNG หรือ WebP`);
    }
    if (tooBig > 0) {
      toast.error(`ข้าม ${tooBig} ไฟล์ที่ใหญ่เกิน 5MB`);
    }
    if (accepted.length === 0) return;

    setImages((current) => {
      const room = MAX_PROGRESS_IMAGES - current.length;
      if (room <= 0) {
        toast.error(`แนบได้สูงสุด ${MAX_PROGRESS_IMAGES} รูปต่อหนึ่งอัปเดต`);
        for (const item of accepted) URL.revokeObjectURL(item.preview);
        return current;
      }
      if (accepted.length > room) {
        toast.error(`แนบได้อีก ${room} รูปเท่านั้น`);
        for (const item of accepted.slice(room)) {
          URL.revokeObjectURL(item.preview);
        }
      }
      return [...current, ...accepted.slice(0, room)];
    });
  };

  const removeImage = (preview: string) => {
    URL.revokeObjectURL(preview);
    setImages((current) => current.filter((item) => item.preview !== preview));
  };

  /** Ctrl+V straight into the box attaches every image on the clipboard. */
  const onPaste = (event: React.ClipboardEvent<HTMLDivElement>) => {
    const files = Array.from(event.clipboardData.files).filter((item) =>
      item.type.startsWith("image/"),
    );
    if (files.length === 0) return;
    // Stop the images' placeholder text from also landing in the textarea.
    event.preventDefault();
    addImages(files);
  };

  const submit = () => {
    if (isEmptyRichText(body)) {
      toast.error("กรุณากรอกความคืบหน้า");
      return;
    }

    startTransition(async () => {
      // All-or-nothing: a half-uploaded set would silently lose photos, so a
      // single failure stops the whole submission and nothing is saved.
      const imageUrls: string[] = [];
      for (const [position, item] of images.entries()) {
        setUploading({ done: position, total: images.length });

        const payload = new FormData();
        payload.append("file", item.file);

        const response = await fetch("/api/upload", {
          method: "POST",
          body: payload,
        });
        const result = await response.json();
        if (!response.ok || !result.ok) {
          setUploading(null);
          toast.error(
            result.message ?? `อัปโหลดรูปที่ ${position + 1} ไม่สำเร็จ`,
          );
          return;
        }
        imageUrls.push(result.url as string);
      }
      setUploading(null);

      const result = await createProgressAction({
        taskId,
        entryDate,
        body,
        imageUrls,
      });

      if (!result.ok) {
        toast.error(result.message);
        return;
      }

      toast.success("ส่งความคืบหน้าแล้ว");
      setBody(EMPTY_DOC);
      for (const item of images) URL.revokeObjectURL(item.preview);
      setImages([]);
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
              <RichTextView doc={entry.body} className="mt-2 text-[13px]" />
              {entry.imageUrls.length > 0 ? (
                <ul className="mt-2 flex flex-wrap gap-2">
                  {entry.imageUrls.map((url, position) => (
                    <li key={url}>
                      <button
                        type="button"
                        onClick={() =>
                          setLightbox({
                            images: entry.imageUrls,
                            index: position,
                          })
                        }
                        aria-label={`ดูรูปที่ ${position + 1} ขนาดเต็ม`}
                        className="block cursor-zoom-in"
                      >
                        <Image
                          src={url}
                          alt=""
                          width={160}
                          height={160}
                          unoptimized
                          className="border-line size-24 rounded-xl border object-cover"
                        />
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}

              <ProgressReplies
                comments={entry.comments}
                members={members}
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
        <div onPaste={onPaste}>
          <RichTextEditor
            value={body}
            onChange={setBody}
            members={members}
            ariaLabel="ข้อความความคืบหน้า"
            placeholder="วันนี้ทำอะไรไปบ้าง (แนบได้หลายรูป หรือวางด้วย Ctrl+V)"
            minHeight={72}
            className="bg-surface"
          />
        </div>

        {images.length > 0 ? (
          <ul className="mt-2 flex flex-wrap gap-2">
            {images.map((item, position) => (
              <li key={item.preview} className="relative">
                <Image
                  src={item.preview}
                  alt={`ตัวอย่างรูปที่ ${position + 1}`}
                  width={120}
                  height={120}
                  unoptimized
                  className="border-line size-20 rounded-lg border object-cover"
                />
                <button
                  type="button"
                  onClick={() => removeImage(item.preview)}
                  aria-label={`เอารูปที่ ${position + 1} ออก`}
                  className="bg-surface border-line absolute -top-2 -right-2 inline-flex size-6 items-center justify-center rounded-full border"
                >
                  <X size={12} strokeWidth={2} />
                </button>
              </li>
            ))}
          </ul>
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
            multiple
            className="sr-only"
            onChange={(event) =>
              addImages(Array.from(event.target.files ?? []))
            }
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
            {images.length > 0 ? ` (${images.length})` : ""}
          </Button>

          <Button
            type="button"
            size="sm"
            className="ml-auto"
            onClick={submit}
            disabled={pending}
          >
            {uploading
              ? `กำลังอัปโหลด ${uploading.done + 1}/${uploading.total}`
              : pending
                ? "กำลังส่ง"
                : "ส่งความคืบหน้า"}
          </Button>
        </div>
      </div>
      <ImageLightbox state={lightbox} onClose={() => setLightbox(null)} />
    </section>
  );
}
