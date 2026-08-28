"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import { ChevronLeft, ChevronRight, X } from "lucide-react";

export type LightboxState = { images: string[]; index: number } | null;

/**
 * Full-size viewer for progress photos, with arrows when an update has several.
 *
 * Rendered through a portal on document.body: the dialog it opens from is
 * centred with a CSS transform, and a transformed ancestor becomes the
 * containing block for `position: fixed`, so an inline overlay would be pinned
 * to the dialog instead of the viewport.
 */
export function ImageLightbox({
  state,
  onClose,
}: {
  state: LightboxState;
  onClose: () => void;
}) {
  // document only exists on the client; wait for mount before portalling.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const [index, setIndex] = useState(0);
  useEffect(() => setIndex(state?.index ?? 0), [state]);

  const total = state?.images.length ?? 0;
  const step = useCallback(
    (delta: number) => setIndex((current) => (current + delta + total) % total),
    [total],
  );

  useEffect(() => {
    if (!state) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        // Close only the image, not the task dialog underneath it.
        event.stopPropagation();
        onClose();
        return;
      }
      if (total < 2) return;
      if (event.key === "ArrowRight") {
        event.stopPropagation();
        step(1);
      }
      if (event.key === "ArrowLeft") {
        event.stopPropagation();
        step(-1);
      }
    };
    // Capture phase, so this runs before the dialog's own Escape handler.
    document.addEventListener("keydown", onKeyDown, true);
    return () => document.removeEventListener("keydown", onKeyDown, true);
  }, [state, onClose, step, total]);

  if (!state || !mounted || total === 0) return null;

  const arrowClass =
    "absolute top-1/2 -translate-y-1/2 inline-flex size-11 items-center justify-center rounded-full bg-white/15 text-white hover:bg-white/25";

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

      {total > 1 ? (
        <>
          <button
            type="button"
            aria-label="รูปก่อนหน้า"
            className={`${arrowClass} left-4`}
            onClick={(event) => {
              event.stopPropagation();
              step(-1);
            }}
          >
            <ChevronLeft size={22} strokeWidth={2} />
          </button>
          <button
            type="button"
            aria-label="รูปถัดไป"
            className={`${arrowClass} right-4`}
            onClick={(event) => {
              event.stopPropagation();
              step(1);
            }}
          >
            <ChevronRight size={22} strokeWidth={2} />
          </button>

          <span className="absolute bottom-6 left-1/2 -translate-x-1/2 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold text-white">
            {index + 1} / {total} รูป
          </span>
        </>
      ) : null}

      <Image
        src={state.images[index]}
        alt={`รูปประกอบความคืบหน้า ${index + 1} จาก ${total}`}
        width={1600}
        height={1200}
        unoptimized
        onClick={(event) => event.stopPropagation()}
        className="max-h-[85vh] w-auto max-w-full rounded-xl object-contain"
      />
    </div>,
    document.body,
  );
}
