import { randomUUID } from "node:crypto";
import { extname } from "node:path";
import { env } from "@/lib/env";
import { localStorageAdapter } from "./local";

export {
  ALLOWED_IMAGE_TYPES,
  MAX_IMAGE_BYTES,
  isAllowedImageType,
} from "./limits";

/**
 * Pluggable object storage. Only the resulting URL is persisted — image bytes
 * never go into the database (SPEC section 1).
 *
 * `local` writes under .uploads/ and is served by app/api/uploads/[...path];
 * it exists so development and self-hosting work with no cloud account. Set
 * STORAGE_PROVIDER to s3 or vercel-blob in production.
 */
export type StoredFile = { url: string };

export interface StorageAdapter {
  put(key: string, body: Buffer, contentType: string): Promise<StoredFile>;
}

const EXTENSION_BY_TYPE: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
};

/** Random, extension-normalised key: the client filename is never trusted. */
export function buildObjectKey(originalName: string, contentType: string) {
  const extension =
    EXTENSION_BY_TYPE[contentType] ??
    (extname(originalName).toLowerCase() || ".bin");
  return `progress/${randomUUID()}${extension}`;
}

async function resolveAdapter(): Promise<StorageAdapter> {
  switch (env.STORAGE_PROVIDER) {
    case "vercel-blob": {
      const { vercelBlobAdapter } = await import("./vercel-blob");
      return vercelBlobAdapter;
    }
    case "s3": {
      const { s3Adapter } = await import("./s3");
      return s3Adapter;
    }
    default:
      return localStorageAdapter;
  }
}

export async function putObject(
  originalName: string,
  body: Buffer,
  contentType: string,
): Promise<StoredFile> {
  const adapter = await resolveAdapter();
  return adapter.put(
    buildObjectKey(originalName, contentType),
    body,
    contentType,
  );
}
