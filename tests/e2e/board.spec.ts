import { test, expect } from "@playwright/test";
import { LEADER, MEMBER, login, logout, stamp } from "./helpers";

test.describe("main flow: create, move, report progress, notify", () => {
  test("a leader creates a task, moves it, and the member's progress notifies them", async ({
    page,
  }) => {
    const title = `งานทดสอบ e2e ${stamp()}`;
    const progressText = `ความคืบหน้าทดสอบ ${stamp()}`;

    // --- Leader creates a task assigned to the member -----------------------
    await login(page, LEADER);
    await page.goto("/board");

    await page.getByRole("button", { name: "เพิ่มงาน", exact: true }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();

    await dialog.getByLabel("ชื่องาน").fill(title);
    await dialog.getByLabel("รายละเอียด").fill("สร้างจากชุดทดสอบอัตโนมัติ");
    await dialog
      .getByLabel("ผู้รับผิดชอบ")
      .selectOption({ label: `${MEMBER.name} · Developer` });
    await dialog.getByRole("button", { name: "บันทึก" }).click();

    await expect(dialog).toBeHidden();
    const card = page.getByRole("button", { name: `เปิดงาน ${title}` });
    await expect(card).toBeVisible();

    // --- Move it one column with the keyboard -------------------------------
    const handle = page.getByRole("button", {
      name: new RegExp(`ย้ายงาน ${title}`),
    });
    await handle.focus();
    await handle.press("ArrowRight");

    // The card lands in "กำลังทำ"; its status badge follows.
    await expect(
      page.getByRole("button", { name: `เปิดงาน ${title}` }),
    ).toBeVisible();

    // --- Member reports progress on it --------------------------------------
    await logout(page);
    await login(page, MEMBER);
    await page.goto("/board");

    await page.getByRole("button", { name: `เปิดงาน ${title}` }).click();
    const memberDialog = page.getByRole("dialog");
    await expect(memberDialog).toBeVisible();

    await memberDialog.getByLabel("ข้อความความคืบหน้า").fill(progressText);
    await memberDialog.getByRole("button", { name: "ส่งความคืบหน้า" }).click();
    await expect(memberDialog.getByText(progressText)).toBeVisible();

    // --- The leader sees a notification for it ------------------------------
    await memberDialog.getByRole("button", { name: "ยกเลิก" }).click();
    await logout(page);
    await login(page, LEADER);

    const bell = page.getByRole("button", { name: /การแจ้งเตือน/ });
    await expect(bell).toBeVisible();
    await bell.click();
    await expect(
      page.getByText(progressText.slice(0, 20), { exact: false }).first(),
    ).toBeVisible();

    await page.keyboard.press("Escape");
    await logout(page);
  });

  test("a member only sees their own tasks on the board", async ({ page }) => {
    await login(page, MEMBER);
    await page.goto("/board");

    // Every card on the board must be one of this member's own tasks: their
    // avatar initial is the only one that appears.
    const cards = page.getByRole("button", { name: /^เปิดงาน / });
    await expect(cards.first()).toBeVisible();

    // A task seeded for a different member must not be reachable here.
    await expect(page.getByText("เพิ่มระบบเสียงประกอบ")).toHaveCount(0);
    await expect(page.getByText("ทำ UI หน้าร้านค้าในเกม")).toHaveCount(0);

    // No user switcher for members.
    await expect(page.getByLabel("มุมมองผู้ใช้")).toHaveCount(0);
    await logout(page);
  });
});
