import { test, expect } from "@playwright/test";
import { LEADER, MEMBER, login, logout } from "./helpers";

test.describe("authentication and route guards", () => {
  test("rejects bad credentials without revealing which field was wrong", async ({
    page,
  }) => {
    await page.goto("/login");
    await page.getByLabel("อีเมล").fill(LEADER.email);
    await page.getByLabel("รหัสผ่าน").fill("definitely-wrong");
    await page.getByRole("button", { name: "เข้าสู่ระบบ" }).click();

    // Next.js injects its own role="alert" route announcer, so scope to the form.
    const alert = page.locator("form").getByRole("alert");
    await expect(alert).toBeVisible();
    await expect(alert).toContainText("อีเมลหรือรหัสผ่านไม่ถูกต้อง");
    await expect(page).toHaveURL(/\/login/);
  });

  test("sends an anonymous visitor to login", async ({ page }) => {
    await page.goto("/board");
    await expect(page).toHaveURL(/\/login/);
  });

  test("lands a leader on the dashboard", async ({ page }) => {
    await login(page, LEADER);
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.getByRole("heading", { name: "ภาพรวม" })).toBeVisible();
    await logout(page);
  });

  test("lands a member on the board and keeps them out of leader-only pages", async ({
    page,
  }) => {
    await login(page, MEMBER);
    await expect(page).toHaveURL(/\/board/);

    // Typing the URL directly must not get a member in.
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/board/);

    await page.goto("/settings/members");
    await expect(page).toHaveURL(/\/board/);

    await logout(page);
  });

  test("hides the leader-only nav tab from members", async ({ page }) => {
    await login(page, MEMBER);
    await expect(page.getByRole("link", { name: "บอร์ดคัมบัง" })).toBeVisible();
    await expect(page.getByRole("link", { name: "ภาพรวม" })).toHaveCount(0);
    await logout(page);
  });
});
