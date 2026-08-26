import { test as setup, expect } from "@playwright/test";
import { LEADER, MEMBER, login } from "./helpers";
import { STORAGE_STATE } from "../../playwright.config";

/**
 * Signs in once per role and saves the session. The rest of the suite reuses
 * these, which keeps the run fast and stays well inside the login rate limit.
 */

setup("authenticate as leader", async ({ page }) => {
  await login(page, LEADER);
  await expect(page).toHaveURL(/\/dashboard/);
  await page.context().storageState({ path: STORAGE_STATE.leader });
});

setup("authenticate as member", async ({ page }) => {
  await login(page, MEMBER);
  await expect(page).toHaveURL(/\/board/);
  await page.context().storageState({ path: STORAGE_STATE.member });
});
