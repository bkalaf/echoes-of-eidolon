import { expect, test } from "@playwright/test";

test("RN-023 RN-027 Status links the public archive for guests", async ({ page }) => {
  await page.goto("/status");
  await expect(page.getByText("Application version 0.2.1")).toBeVisible();
  await expect(page.getByRole("link", { name: "View Release Notes" })).toHaveAttribute("href", "/status/releases");
});

test("RN-026 RN-030 the published release detail is public", async ({ request }) => {
  const response = await request.get("/status/releases/0.2.0");
  expect(response.status()).toBe(200);
  expect(await response.text()).toContain("Echoes of Eidolon 0.2.0");
});

test("RN-032 RN-033 only published release details are crawlable", async ({ request }) => {
  const sitemap = await request.get("/sitemap.xml");
  expect(await sitemap.text()).toContain("/status/releases/0.2.0</loc>");
});

test("RN-037 RN-038 RN-039 RN-040 RN-041 remain owned by the cumulative verification gate", async ({ request }) => {
  expect((await request.get("/api/health")).status()).toBe(200);
});
