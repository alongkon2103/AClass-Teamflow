import type { StorageAdapter } from "./index";

/**
 * Vercel Blob adapter. The SDK is imported lazily so the dependency is only
 * required when STORAGE_PROVIDER=vercel-blob.
 */
export const vercelBlobAdapter: StorageAdapter = {
  async put(key, body, contentType) {
    const { put } = await import("@vercel/blob");
    const result = await put(key, body, {
      access: "public",
      contentType,
      addRandomSuffix: false,
    });
    return { url: result.url };
  },
};
