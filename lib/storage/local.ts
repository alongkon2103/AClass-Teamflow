import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join, normalize, sep } from "node:path";
import type { StorageAdapter } from "./index";

/** Root for locally stored uploads. Gitignored; served by an API route. */
export const UPLOAD_ROOT = join(process.cwd(), ".uploads");

/**
 * Resolve a storage key to a path inside UPLOAD_ROOT, refusing anything that
 * escapes it. Keys are generated server-side, but this keeps the guarantee even
 * if that ever changes.
 */
export function resolveUploadPath(key: string): string | null {
  const target = normalize(join(UPLOAD_ROOT, key));
  if (target !== UPLOAD_ROOT && !target.startsWith(UPLOAD_ROOT + sep)) {
    return null;
  }
  return target;
}

export const localStorageAdapter: StorageAdapter = {
  async put(key, body) {
    const target = resolveUploadPath(key);
    if (!target) throw new Error("เส้นทางไฟล์ไม่ถูกต้อง");
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, body);
    return { url: `/api/uploads/${key}` };
  },
};
