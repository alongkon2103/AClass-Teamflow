/**
 * Runs once when the Node.js server process boots. Importing lib/env here forces
 * environment validation at startup so the process crashes immediately (naming the
 * offending variable) rather than on the first request that needs it.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("@/lib/env");
  }
}
