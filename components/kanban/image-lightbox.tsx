"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import { X } from "lucide-react";

/**
 * Full-size view of a progress image.
 *
 * Rendered through a portal on document.body: the dialog it is opened from is
 * centred with a CSS transform, and a transformed ancestor becomes the
 * containing block for `position: fixed`, so an inline overlay would be pinned
 * to the dialog instead of the viewport.
 */
export function ImageLightbox({
  src,
  onClose,
}: {
  src: string | null;
  onClose: () => void;
}) {
  // document only exists on the client; wait for mount before portalling.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!src) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      // Close only the image, not the task dialog underneath it.
      event.stopPropagation();
      onClose();
    };
    // Capture phase, so this runs before the dialog's own Escape handler.
    document.addEventListener("keydown", onKeyDown, true);
    return () => document.removeEventListener("keydown", onKeyDown, true);
  }, [src, onClose]);

  if (!src || !mounted) return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="ดูรูปขนาดเต็ม"
      onClick={onClose}
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 p-6"
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="ปิด"
        className="absolute top-4 right-4 inline-flex size-10 items-center justify-center rounded-xl bg-white/15 text-white hover:bg-white/25"
      >
        <X size={18} strokeWidth={2} />
      </button>

      <Image
        src={src}
        alt="รูปประกอบความคืบหน้า"
        width={1600}
        height={1200}
        unoptimized
        onClick={(event) => event.stopPropagation()}
        className="max-h-[90vh] w-auto max-w-full rounded-xl object-contain"
      />
    </div>,
    document.body,
  );
}
