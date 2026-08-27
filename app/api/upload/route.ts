import { NextResponse } from "next/server";
import { requireActor } from "@/lib/auth";
import {
  ALLOWED_IMAGE_TYPES,
  MAX_IMAGE_BYTES,
  isAllowedImageType,
  putObject,
  type UploadKind,
} from "@/lib/storage";

/**
 * Accepts one image and returns its stored URL. Type and size are re-checked
 * here because the client-side checks are only a convenience (SPEC section 7).
 */
export async function POST(request: Request) {
  try {
    await requireActor();
  } catch {
    return NextResponse.json(
      { ok: false, message: "กรุณาเข้าสู่ระบบ" },
      { status: 401 },
    );
  }

  const formData = await request.formData().catch(() => null);
  const file = formData?.get("file");
  // Anything unrecognised files as a progress image rather than being trusted.
  const kind: UploadKind =
    formData?.get("kind") === "avatar" ? "avatar" : "progress";

  if (!(file instanceof File)) {
    return NextResponse.json(
      { ok: false, message: "ไม่พบไฟล์ที่อัปโหลด" },
      { status: 400 },
    );
  }

  if (!isAllowedImageType(file.type)) {
    return NextResponse.json(
      {
        ok: false,
        message: `รองรับเฉพาะไฟล์ ${ALLOWED_IMAGE_TYPES.join(", ")}`,
      },
      { status: 415 },
    );
  }

  if (file.size > MAX_IMAGE_BYTES) {
    return NextResponse.json(
      { ok: false, message: "ไฟล์ต้องมีขนาดไม่เกิน 5MB" },
      { status: 413 },
    );
  }

  const bytes = Buffer.from(await file.arrayBuffer());

  // Verify the magic number: a renamed file must not pass on its header alone.
  if (!looksLikeImage(bytes, file.type)) {
    return NextResponse.json(
      { ok: false, message: "ไฟล์นี้ไม่ใช่รูปภาพที่รองรับ" },
      { status: 415 },
    );
  }

  try {
    const stored = await putObject(file.name, bytes, file.type, kind);
    return NextResponse.json({ ok: true, url: stored.url });
  } catch (error) {
    console.error("[upload]", error);
    return NextResponse.json(
      { ok: false, message: "อัปโหลดไม่สำเร็จ กรุณาลองใหม่" },
      { status: 500 },
    );
  }
}

/** Minimal magic-number check for the three formats we accept. */
function looksLikeImage(bytes: Buffer, declaredType: string): boolean {
  if (bytes.length < 12) return false;
  const isJpeg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  const isPng =
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47;
  const isWebp =
    bytes.toString("ascii", 0, 4) === "RIFF" &&
    bytes.toString("ascii", 8, 12) === "WEBP";

  switch (declaredType) {
    case "image/jpeg":
      return isJpeg;
    case "image/png":
      return isPng;
    case "image/webp":
      return isWebp;
    default:
      return false;
  }
}
