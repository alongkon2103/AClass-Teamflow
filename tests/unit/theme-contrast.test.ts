import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { contrastRatio, composite, AA_NORMAL_TEXT } from "@/lib/contrast";
import { themeClassFromCookie } from "@/lib/theme";

/**
 * Guards SPEC 6.4 #11: both themes must clear WCAG AA. Values are read straight
 * out of globals.css so the test fails if a token is edited to something unreadable.
 */
const css = readFileSync(join(process.cwd(), "app", "globals.css"), "utf8");

/** Pull `--name: #hex;` out of a specific selector block. */
function tokensIn(selector: string): Record<string, string> {
  const start = css.indexOf(selector);
  if (start === -1) throw new Error(`selector not found: ${selector}`);
  const open = css.indexOf("{", start);
  const end = css.indexOf("\n}", open);
  const block = css.slice(open, end);
  const found: Record<string, string> = {};
  for (const match of block.matchAll(
    /--([\w-]+):\s*(#[0-9a-fA-F]{3,8})\s*;/g,
  )) {
    found[match[1]] = match[2];
  }
  return found;
}

const light = tokensIn(":root {");
const dark = tokensIn(":root.dark {");

const SEMANTIC = [
  "todo",
  "doing",
  "review",
  "done",
  "danger",
  "leave",
] as const;
const BADGE_ALPHA = { light: 0.16, dark: 0.2 };

describe.each([
  ["light", light, BADGE_ALPHA.light],
  ["dark", dark, BADGE_ALPHA.dark],
])("%s theme contrast", (name, t, badgeAlpha) => {
  const surfaces = () => [
    ["surface", t.surface],
    ["bg", t.bg],
    ["hover", t.hover],
    ["input-bg", t["input-bg"]],
    ["header", t.header],
  ];

  it("defines every token it needs", () => {
    for (const key of [
      "bg",
      "surface",
      "ink",
      "muted",
      "primary",
      "primary-fg",
      "primary-ink",
    ]) {
      expect(t[key], `${name}: --${key}`).toMatch(/^#[0-9a-fA-F]{6}$/);
    }
  });

  it("body and muted text clear AA on every surface", () => {
    for (const [label, surface] of surfaces()) {
      expect(
        contrastRatio(t.ink, surface),
        `${name}: ink on ${label}`,
      ).toBeGreaterThanOrEqual(AA_NORMAL_TEXT);
      expect(
        contrastRatio(t.muted, surface),
        `${name}: muted on ${label}`,
      ).toBeGreaterThanOrEqual(AA_NORMAL_TEXT);
    }
  });

  it("primary button label clears AA on the primary fill", () => {
    expect(
      contrastRatio(t["primary-fg"], t.primary),
      `${name}: button label on primary`,
    ).toBeGreaterThanOrEqual(AA_NORMAL_TEXT);
  });

  it("primary ink clears AA on surface and on primary-soft", () => {
    for (const [label, surface] of [
      ["surface", t.surface],
      ["primary-soft", t["primary-soft"]],
      ["bg", t.bg],
    ] as const) {
      expect(
        contrastRatio(t["primary-ink"], surface),
        `${name}: primary-ink on ${label}`,
      ).toBeGreaterThanOrEqual(AA_NORMAL_TEXT);
    }
  });

  it.each(SEMANTIC)("%s ink clears AA on its own badge tint", (key) => {
    const ink = t[`${key}-ink`];
    expect(ink, `${name}: --${key}-ink missing`).toBeDefined();

    // Mark colours live in the @theme block and are theme-independent.
    const markMatch = css.match(
      new RegExp(`--color-${key}:\\s*(#[0-9a-fA-F]{6})`),
    );
    const mark = markMatch![1];

    for (const [label, surface] of [
      ["surface", t.surface],
      ["bg", t.bg],
      ["hover", t.hover],
    ] as const) {
      expect(
        contrastRatio(ink, surface),
        `${name}: ${key}-ink on ${label}`,
      ).toBeGreaterThanOrEqual(AA_NORMAL_TEXT);

      expect(
        contrastRatio(ink, composite(mark, badgeAlpha, surface)),
        `${name}: ${key}-ink on badge tint over ${label}`,
      ).toBeGreaterThanOrEqual(AA_NORMAL_TEXT);
    }
  });
});

describe("theme cookie", () => {
  it("maps an explicit preference to a class and system to none", () => {
    expect(themeClassFromCookie("dark")).toBe("dark");
    expect(themeClassFromCookie("light")).toBe("light");
    // No cookie means "follow the OS" — no class, so CSS media query decides.
    expect(themeClassFromCookie(undefined)).toBe("");
    expect(themeClassFromCookie("bogus")).toBe("");
  });
});
