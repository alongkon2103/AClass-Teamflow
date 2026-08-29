/**
 * A very small flag parser. Everything the CLI needs is `--flag value`,
 * `--flag=value` or a bare `--switch`; anything else is a positional.
 */
export type Args = {
  positional: string[];
  flags: Record<string, string | true>;
};

export function parseArgs(argv: string[]): Args {
  const positional: string[] = [];
  const flags: Record<string, string | true> = {};

  for (let index = 0; index < argv.length; index++) {
    const token = argv[index];

    if (!token.startsWith("--")) {
      positional.push(token);
      continue;
    }

    const body = token.slice(2);
    const equals = body.indexOf("=");
    if (equals !== -1) {
      flags[body.slice(0, equals)] = body.slice(equals + 1);
      continue;
    }

    const next = argv[index + 1];
    // A following token that itself looks like a flag means this is a switch.
    if (next === undefined || next.startsWith("--")) {
      flags[body] = true;
    } else {
      flags[body] = next;
      index++;
    }
  }

  return { positional, flags };
}

export function flagValue(args: Args, name: string): string | null {
  const value = args.flags[name];
  return typeof value === "string" ? value : null;
}

export function hasFlag(args: Args, name: string): boolean {
  return args.flags[name] !== undefined;
}
