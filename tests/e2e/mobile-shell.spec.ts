import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("mobile closet navigation and photo entry remain usable", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "The closet" })).toBeVisible();
  await page.getByRole("button", { name: "Tops", exact: true }).click();
  await expect(page.getByRole("heading", { name: "No tops saved." })).toBeVisible();

  await page.getByRole("button", { name: "Create" }).click();
  await expect(page.getByRole("heading", { name: "Swipe to style" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Top + bottom" })).toBeVisible();
  await page.getByRole("button", { name: "Style Deck" }).click();
  await expect(page.getByRole("heading", { name: "Add a wearable pair." })).toBeVisible();
  await page.getByRole("button", { name: "Outfits" }).click();
  await expect(page.getByRole("heading", { name: "Saved looks" })).toBeVisible();

  await page.getByRole("button", { name: "Closet" }).click();
  await page.getByRole("button", { name: "Add item" }).click();
  await expect(page.getByRole("dialog", { name: "Add clothing photo" })).toBeVisible();
  await expect(page.getByText("Keep it clean.")).toBeVisible();
});

test("mobile shell has no serious automated accessibility violations", async ({ page }) => {
  await page.goto("/");
  const results = await new AxeBuilder({ page }).analyze();
  const serious = results.violations.filter(({ impact }) => impact === "serious" || impact === "critical");
  expect(serious).toEqual([]);
});
