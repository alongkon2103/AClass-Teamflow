import { z } from "zod";

/**
 * Central environment schema. Parsed once at server boot (see instrumentation.ts)
 * and wherever env is consumed, so a missing or malformed variable fails fast with
 * a readable message instead of surfacing later as a confusing runtime error.
 */
const isPostgresUrl = (value: string) =>
  value.startsWith("postgres://") || value.startsWith("postgresql://");

const envSchema = z.object({
  // App runtime connection. On Supabase this is the pooled connection (port 6543).
  DATABASE_URL: z
    .string()
    .refine(isPostgresUrl, "must be a PostgreSQL connection string"),
  // Direct connection, used only by Prisma migrations. On Supabase this is the
  // direct connection (port 5432); for local Postgres it can equal DATABASE_URL.
  DIRECT_URL: z
    .string()
    .refine(isPostgresUrl, "must be a PostgreSQL connection string"),
  // Session/JWT signing secret. Generate with: openssl rand -base64 32
  AUTH_SECRET: z.string().min(32, "must be at least 32 characters"),
  // Public origin of the app. Optional in dev (Auth.js infers it from the request),
  // required in production for correct callback URLs.
  AUTH_URL: z.url().optional(),
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),

  // --- Object storage for progress images (wired up in Phase 5; optional for now) ---
  STORAGE_PROVIDER: z.enum(["s3", "vercel-blob"]).optional(),
  BLOB_READ_WRITE_TOKEN: z.string().optional(),
  S3_ENDPOINT: z.url().optional(),
  S3_REGION: z.string().optional(),
  S3_BUCKET: z.string().optional(),
  S3_ACCESS_KEY_ID: z.string().optional(),
  S3_SECRET_ACCESS_KEY: z.string().optional(),
  // Public base URL for reading objects back (CDN or bucket URL).
  S3_PUBLIC_URL: z.url().optional(),
});

export type Env = z.infer<typeof envSchema>;

function loadEnv(): Env {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map(
        (issue) => `  - ${issue.path.join(".") || "(root)"}: ${issue.message}`,
      )
      .join("\n");
    throw new Error(
      `Invalid environment variables:\n${issues}\n\n` +
        `Copy .env.example to .env and fill in the missing values.`,
    );
  }
  return parsed.data;
}

export const env = loadEnv();
