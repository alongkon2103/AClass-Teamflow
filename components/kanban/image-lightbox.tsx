"use client";

import { useEffect } from "react";
import Image from "next/image";
import { X } from "lucide-react";

/**
 * Full-size view of a progress image. Rendered only while open, closes on
 * Escape or a click outside, and returns focus handling to the browser.
 */
export function ImageLightbox({
  src,
  onClose,
}: {
  src: string | null;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!src) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [src, onClose]);

  if (!src) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="ดูรูปขนาดเต็ม"
      onClick={onClose}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-6"
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="ปิด"
        className="absolute top-4 right-4 inline-flex size-10 items-center justify-center rounded-xl bg-white/10 text-white"
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
        className="max-h-full w-auto max-w-full rounded-xl object-contain"
      />
    </div>
  );
}
