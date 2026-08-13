import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("anonymous visitors are redirected before private UI renders", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/sign-in$/);
  await expect(page.getByRole("heading", { name: "Open your closet" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "The closet" })).toHaveCount(0);
});

test("mobile shell has no serious automated accessibility violations", async ({ page }) => {
  await page.goto("/sign-in");
  const results = await new AxeBuilder({ page }).analyze();
  const serious = results.violations.filter(({ impact }) => impact === "serious" || impact === "critical");
  expect(serious).toEqual([]);
});

test("install manifest describes a standalone portrait app", async ({ request }) => {
  const response = await request.get("/manifest.webmanifest");
  expect(response.ok()).toBeTruthy();

  const manifest = await response.json();
  expect(manifest).toMatchObject({
    name: "JijiSwipe",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
  });
  expect(manifest.icons).toContainEqual(expect.objectContaining({ src: "/icon.svg" }));
});
