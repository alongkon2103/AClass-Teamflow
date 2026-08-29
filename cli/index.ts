import { loadEnvFiles } from "./env";

/**
 * TeamFlow from the terminal.
 *
 * The CLI talks to the same database as the web app and goes through the same
 * services in server/services, so permissions, validation and notifications
 * behave identically — there is no second copy of the rules to keep in step.
 *
 * DATABASE_URL is read from .env, which is why the env has to be in place
 * before anything imports lib/db; hence the dynamic import below.
 */
async function main(): Promise<void> {
  loadEnvFiles();

  if (!process.env.DATABASE_URL) {
    console.error(
      "ไม่พบ DATABASE_URL — เปิด tunnel แล้วรันจากโฟลเดอร์โปรเจกต์ หรือรันบนเครื่อง server",
    );
    process.exitCode = 1;
    return;
  }

  const { run } = await import("./run");
  process.exitCode = await run(process.argv.slice(2));
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
