import { readFile, stat } from "node:fs/promises";
import { extname } from "node:path";
import { NextResponse } from "next/server";
import { requireActor } from "@/lib/auth";
import { resolveUploadPath } from "@/lib/storage/local";

const CONTENT_TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
};

/**
 * Serves locally stored uploads. Progress images are internal team data, so the
 * route requires a session rather than exposing the files publicly.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ path: string[] }> },
) {
  try {
    await requireActor();
  } catch {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const { path } = await params;
  const filePath = resolveUploadPath(path.join("/"));
  if (!filePath) return new NextResponse("Not found", { status: 404 });

  const contentType = CONTENT_TYPES[extname(filePath).toLowerCase()];
  if (!contentType) return new NextResponse("Not found", { status: 404 });

  try {
    const info = await stat(filePath);
    if (!info.isFile()) return new NextResponse("Not found", { status: 404 });
    const body = await readFile(filePath);
    return new NextResponse(new Uint8Array(body), {
      headers: {
        "Content-Type": contentType,
        "Content-Length": String(info.size),
        "Cache-Control": "private, max-age=31536000, immutable",
      },
    });
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }
}
