import { expect, type Page } from "@playwright/test";

export const LEADER = {
  email: "leader@teamflow.app",
  password: "password1234",
  name: "กมล ประสิทธิ์",
};

export const MEMBER = {
  email: "napa@teamflow.app",
  password: "password1234",
  name: "นภา จันทร์เพ็ญ",
};

export async function login(
  page: Page,
  who: { email: string; password: string },
) {
  await page.goto("/login");
  await page.getByLabel("อีเมล").fill(who.email);
  await page.getByLabel("รหัสผ่าน").fill(who.password);
  await page.getByRole("button", { name: "เข้าสู่ระบบ" }).click();
  // Landing route differs by role; both leave /login behind.
  await expect(page).not.toHaveURL(/\/login/, { timeout: 30_000 });
}

export async function logout(page: Page) {
  // A dialog left open covers the header with a modal overlay, so dismiss
  // anything on top before reaching for the sign-out button.
  await closeAnyDialog(page);
  await page.getByRole("button", { name: "ออกจากระบบ" }).click();
  await expect(page).toHaveURL(/\/login/, { timeout: 30_000 });
}

/** Presses Escape until no dialog remains (no-op when none is open). */
export async function closeAnyDialog(page: Page) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    if ((await page.getByRole("dialog").count()) === 0) return;
    await page.keyboard.press("Escape");
    await page.waitForTimeout(200);
  }
}

/** Unique-ish suffix so repeated runs do not collide on names. */
export function stamp(): string {
  return Math.random().toString(36).slice(2, 8);
}
