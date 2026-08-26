"use client";

import { Moon, Sun } from "lucide-react";
import { THEME_COOKIE } from "@/lib/theme";

/**
 * Writes the preference to a cookie (read by the server on the next render) and
 * flips the html class immediately, so the switch is instant and survives reloads.
 * Which icon shows is decided purely in CSS via the `dark:` variant — that keeps
 * server and client markup identical, so there is no hydration mismatch.
 */
export function ThemeToggle() {
  const toggle = () => {
    const root = document.documentElement;
    const isDark = root.classList.contains("dark")
      ? true
      : root.classList.contains("light")
        ? false
        : window.matchMedia("(prefers-color-scheme: dark)").matches;

    const next = isDark ? "light" : "dark";
    root.classList.remove("light", "dark");
    root.classList.add(next);
    document.cookie = `${THEME_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
  };

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label="สลับธีมสว่างและมืด"
      className="border-line bg-hover text-ink hover:bg-primary-soft inline-flex size-10 items-center justify-center rounded-xl border transition-colors duration-150"
    >
      <Moon size={16} strokeWidth={2} className="dark:hidden" />
      <Sun size={16} strokeWidth={2} className="hidden dark:block" />
    </button>
  );
}
