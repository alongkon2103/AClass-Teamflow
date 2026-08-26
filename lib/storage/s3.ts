import type { StorageAdapter } from "./index";
import { env } from "@/lib/env";

/**
 * S3-compatible adapter (AWS S3, Cloudflare R2, MinIO). The SDK is imported
 * lazily so the dependency is only required when STORAGE_PROVIDER=s3.
 */
export const s3Adapter: StorageAdapter = {
  async put(key, body, contentType) {
    const { S3Client, PutObjectCommand } = await import("@aws-sdk/client-s3");

    const bucket = env.S3_BUCKET;
    if (!bucket) throw new Error("S3_BUCKET is not configured");

    const client = new S3Client({
      region: env.S3_REGION ?? "auto",
      endpoint: env.S3_ENDPOINT,
      credentials:
        env.S3_ACCESS_KEY_ID && env.S3_SECRET_ACCESS_KEY
          ? {
              accessKeyId: env.S3_ACCESS_KEY_ID,
              secretAccessKey: env.S3_SECRET_ACCESS_KEY,
            }
          : undefined,
    });

    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
      }),
    );

    const base = env.S3_PUBLIC_URL ?? `${env.S3_ENDPOINT}/${bucket}`;
    return { url: `${base.replace(/\/$/, "")}/${key}` };
  },
};
