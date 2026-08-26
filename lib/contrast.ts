/**
 * WCAG relative-luminance helpers. Used by the design-token tests so a palette
 * change that breaks AA fails CI instead of shipping.
 */
export type Rgb = [number, number, number];

export function hexToRgb(hex: string): Rgb {
  const clean = hex.replace("#", "");
  const full =
    clean.length === 3
      ? clean
          .split("")
          .map((char) => char + char)
          .join("")
      : clean;
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16)) as Rgb;
}

function channelLuminance(value: number): number {
  const c = value / 255;
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

export function relativeLuminance(colour: string | Rgb): number {
  const [r, g, b] = (
    typeof colour === "string" ? hexToRgb(colour) : colour
  ).map(channelLuminance);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(a: string | Rgb, b: string | Rgb): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

/** Composite a translucent foreground over an opaque background. */
export function composite(
  foreground: string | Rgb,
  alpha: number,
  background: string | Rgb,
): Rgb {
  const fg = typeof foreground === "string" ? hexToRgb(foreground) : foreground;
  const bg = typeof background === "string" ? hexToRgb(background) : background;
  return fg.map((channel, i) => channel * alpha + bg[i] * (1 - alpha)) as Rgb;
}

/** WCAG AA threshold for normal-size text. */
export const AA_NORMAL_TEXT = 4.5;
