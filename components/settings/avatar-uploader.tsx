"use client";

import { useCallback, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Cropper, { type Area } from "react-easy-crop";
import { toast } from "sonner";
import { ImagePlus, Trash2, ZoomIn } from "lucide-react";
import { Avatar } from "@/components/shared/avatar";
import { Button } from "@/components/ui/button";
import { ALLOWED_IMAGE_TYPES, MAX_IMAGE_BYTES } from "@/lib/storage/limits";
import { cropToSquareBlob } from "@/lib/crop-image";
import { setOwnAvatarAction } from "@/server/actions/member";

type CurrentUser = {
  name: string;
  avatarColor: string;
  avatarUrl: string | null;
};

/** Profile photo with a drag-and-zoom square crop before upload. */
export function AvatarUploader({ user }: { user: CurrentUser }) {
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();

  const [source, setSource] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [area, setArea] = useState<Area | null>(null);

  const onCropComplete = useCallback((_: Area, pixels: Area) => {
    setArea(pixels);
  }, []);

  const pick = (file: File | undefined) => {
    if (!file) return;
    if (!(ALLOWED_IMAGE_TYPES as readonly string[]).includes(file.type)) {
      toast.error("รองรับเฉพาะไฟล์ JPG, PNG และ WebP");
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      toast.error("ไฟล์ต้องมีขนาดไม่เกิน 5MB");
      return;
    }
    setSource(URL.createObjectURL(file));
    setCrop({ x: 0, y: 0 });
    setZoom(1);
  };

  const closeEditor = () => {
    if (source) URL.revokeObjectURL(source);
    setSource(null);
    setArea(null);
    if (fileInput.current) fileInput.current.value = "";
  };

  const save = () => {
    if (!source || !area) return;

    startTransition(async () => {
      try {
        const blob = await cropToSquareBlob(source, area);

        const payload = new FormData();
        payload.append(
          "file",
          new File([blob], "avatar.jpg", { type: "image/jpeg" }),
        );
        payload.append("kind", "avatar");

        const response = await fetch("/api/upload", {
          method: "POST",
          body: payload,
        });
        const result = await response.json();
        if (!response.ok || !result.ok) {
          toast.error(result.message ?? "อัปโหลดรูปไม่สำเร็จ");
          return;
        }

        const saved = await setOwnAvatarAction({ avatarUrl: result.url });
        if (!saved.ok) {
          toast.error(saved.message);
          return;
        }

        toast.success("เปลี่ยนรูปโปรไฟล์แล้ว");
        closeEditor();
        router.refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "ตัดรูปไม่สำเร็จ");
      }
    });
  };

  const removePhoto = () =>
    startTransition(async () => {
      const result = await setOwnAvatarAction({ avatarUrl: null });
      if (result.ok) {
        toast.success("ลบรูปโปรไฟล์แล้ว");
        router.refresh();
      } else {
        toast.error(result.message);
      }
    });

  return (
    <section className="border-line bg-surface mb-4 max-w-md rounded-[18px] border p-5 shadow-sm">
      <h2 className="mb-4 text-[15.5px] font-bold">รูปโปรไฟล์</h2>

      {source ? (
        <>
          {/* Fixed-height stage: the cropper measures its own container. */}
          <div className="bg-track relative h-64 w-full overflow-hidden rounded-2xl">
            <Cropper
              image={source}
              crop={crop}
              zoom={zoom}
              aspect={1}
              cropShape="round"
              showGrid={false}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={onCropComplete}
            />
          </div>

          <label className="mt-4 flex items-center gap-3">
            <ZoomIn
              size={16}
              strokeWidth={2}
              className="text-muted-foreground shrink-0"
              aria-hidden="true"
            />
            <span className="sr-only">ระดับการซูม</span>
            <input
              type="range"
              min={1}
              max={3}
              step={0.01}
              value={zoom}
              onChange={(event) => setZoom(Number(event.target.value))}
              aria-label="ระดับการซูม"
              className="accent-primary w-full"
            />
          </label>

          <p className="text-muted-foreground mt-2 text-xs">
            ลากรูปเพื่อจัดตำแหน่ง และเลื่อนแถบเพื่อซูม
          </p>

          <div className="mt-4 flex justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={closeEditor}
              disabled={pending}
            >
              ยกเลิก
            </Button>
            <Button type="button" onClick={save} disabled={pending || !area}>
              {pending ? "กำลังบันทึก" : "บันทึกรูป"}
            </Button>
          </div>
        </>
      ) : (
        <div className="flex flex-wrap items-center gap-4">
          <Avatar user={user} size={72} />

          <div className="flex flex-col gap-2">
            <input
              ref={fileInput}
              type="file"
              accept={ALLOWED_IMAGE_TYPES.join(",")}
              className="sr-only"
              onChange={(event) => pick(event.target.files?.[0])}
            />
            <Button
              type="button"
              onClick={() => fileInput.current?.click()}
              disabled={pending}
            >
              <ImagePlus size={16} strokeWidth={2} />
              {user.avatarUrl ? "เปลี่ยนรูป" : "อัปโหลดรูป"}
            </Button>

            {user.avatarUrl ? (
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={removePhoto}
                disabled={pending}
              >
                <Trash2 size={14} strokeWidth={2} />
                ลบรูป
              </Button>
            ) : (
              <p className="text-muted-foreground text-xs">
                ยังไม่มีรูป ระบบจะใช้อักษรย่อบนสีประจำตัวแทน
              </p>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
