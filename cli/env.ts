import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

/**
 * Loads .env the way `next dev` does, because a plain tsx process does not.
 *
 * Values already in the environment win, so a one-off
 * `DATABASE_URL=... teamflow ls` still works.
 */
export function loadEnvFiles(): void {
  const root = repoRoot();
  for (const name of [".env", ".env.local"]) {
    const path = resolve(root, name);
    if (!existsSync(path)) continue;

    for (const line of readFileSync(path, "utf8").split("\n")) {
      const match =
        /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line);
      if (!match) continue;

      const [, key, rawValue] = match;
      if (process.env[key] !== undefined) continue;

      let value = rawValue.trim();
      // Strip one matching pair of quotes; an unquoted value keeps its #comment
      // only if it is not preceded by whitespace, matching dotenv's behaviour.
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      } else {
        value = value.replace(/\s+#.*$/, "").trim();
      }
      process.env[key] = value;
    }
  }
}

/** The repository root, found from this file rather than the shell's cwd. */
export function repoRoot(): string {
  return resolve(dirname(__filename), "..");
}
