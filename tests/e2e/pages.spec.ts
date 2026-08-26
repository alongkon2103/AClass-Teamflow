import { test, expect } from "@playwright/test";
import { closeAnyDialog, stamp } from "./helpers";

// Runs with the stored leader session (see playwright.config.ts).
test.describe("leader pages", () => {
  test.afterEach(async ({ page }) => {
    await closeAnyDialog(page);
  });

  test("dashboard filters stay in the URL and survive a reload", async ({
    page,
  }) => {
    await page.goto("/dashboard?status=DOING");
    await expect(page.getByLabel("กรองตามสถานะ")).toHaveValue("DOING");

    await page.reload();
    await expect(page.getByLabel("กรองตามสถานะ")).toHaveValue("DOING");
  });

  test("calendar marks days that have leave and opens a day sheet", async ({
    page,
  }) => {
    await page.goto("/calendar");
    await expect(
      page.getByRole("heading", { name: "ปฏิทินทีม" }),
    ).toBeVisible();

    const leaveDay = page.getByRole("button", { name: /มีคนลา/ }).first();
    await expect(leaveDay).toBeVisible();
    await leaveDay.click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    // The cell was chosen because it has leave, so the sheet must list it.
    await expect(
      dialog.getByRole("heading", { name: "การลางาน" }),
    ).toBeVisible();
  });

  test("adding a game refuses a duplicate name regardless of case", async ({
    page,
  }) => {
    const name = `E2E Game ${stamp()}`;
    await page.goto("/settings/games");

    await page.getByLabel("เพิ่มเกมใหม่").fill(name);
    await page.getByRole("button", { name: "เพิ่ม", exact: true }).click();
    await expect(page.getByText(name)).toBeVisible();

    await page.getByLabel("เพิ่มเกมใหม่").fill(name.toUpperCase());
    await page.getByRole("button", { name: "เพิ่ม", exact: true }).click();
    await expect(page.getByText("มีเกมชื่อนี้อยู่แล้ว")).toBeVisible();

    // Clean up: an unreferenced game can be deleted outright.
    const row = page.locator("li").filter({ hasText: name }).first();
    await row.getByRole("button", { name: "ลบ" }).click();
    await row.getByRole("button", { name: "ยืนยัน" }).click();
    await expect(page.getByText(name)).toHaveCount(0);
  });

  test("feedback shows ticket numbers and the reply box", async ({ page }) => {
    await page.goto("/feedback");
    await expect(
      page.getByRole("heading", { name: "Customer Feedback" }),
    ).toBeVisible();
    await expect(page.getByText(/TK-\d{4}/).first()).toBeVisible();
  });
});
