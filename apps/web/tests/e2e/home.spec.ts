import { expect, test } from "@playwright/test";

test("home exposes the approved public task and navigation", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /when the moons align/i })).toBeVisible();
  await expect(page.getByRole("link", { name: "Sign In" })).toBeVisible();
  await expect(page.locator(".feature-card")).toHaveCount(9);
});

test("packet routes expose public, auth, account, and store tasks", async ({ page }) => {
  for (const [path, heading] of [
    ["/features", "Nine ways Echoes plays differently."],
    ["/auth/sign-in", "Sign In"],
    ["/account/subscription?state=ACC008", "Subscription - Active"],
    ["/store/checkout/declined", "Payment Declined"],
  ] as const) {
    await page.goto(path);
    await expect(page.getByRole("heading", { name: heading })).toBeVisible();
  }
});

test("administration routes expose canonical editor, import, atlas, and campaign tasks", async ({ page }) => {
  for (const [path, heading] of [
    ["/admin/data/witness/sample-record", "Edit Witness"],
    ["/admin/data/breed/import", "Bulk Import Breed"],
    ["/admin/atlas/pois?state=ATLAS_POI_3D", "Points of Interest — 3D View"],
    ["/admin/campaign/planner?state=CAMPAIGN_CONCORD", "Main 18-Book Planner — Concord"],
  ] as const) {
    await page.goto(path);
    await expect(page.getByRole("heading", { name: heading })).toBeVisible();
  }
});

test("game routes require an authenticated eligible player", async ({ page }) => {
  for (const path of [
    "/game?state=GAME_VIEW_SINGLE_EXIT",
    "/game/knowledge?state=GAME016",
    "/game/bookshelf",
  ]) {
    await page.goto(path);
    await expect(page.getByRole("heading", { name: "Sign in required" })).toBeVisible();
  }
});

test("review routes expose routed and state-only tasks", async ({ page }) => {
  for (const [path, text] of [
    ["/review/controls/lookups?state=TOOL003", "Control Gallery - Enum Selects"],
    ["/tools/wireframe-builder", "Wireframe Builder"],
  ] as const) {
    await page.goto(path);
    await expect(page.getByText(text, { exact: true }).first()).toBeVisible();
  }
});

test("Atlas data is not disclosed without administrative authorization", async ({ page }) => {
  const response = await page.request.get("/api/atlas/catalog");
  expect(response.status()).toBe(401);
  await page.goto("/admin/atlas/pois?state=ATLAS_POI_2D");
  await expect(page.getByRole("heading", { name: "Sign in required" })).toBeVisible();
  await expect(page.getByText("92 canonical Points of Interest")).not.toBeVisible();
});
