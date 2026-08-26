export const THEME_COOKIE = "tf-theme";

export type ThemePreference = "light" | "dark";

/**
 * Resolve the html class from the theme cookie. An absent cookie means "follow
 * the OS", which renders no class at all and lets the prefers-color-scheme
 * media query in globals.css decide — so the server never guesses wrong and
 * there is no flash of the wrong theme.
 */
export function themeClassFromCookie(value: string | undefined): string {
  return value === "dark" ? "dark" : value === "light" ? "light" : "";
}
