import { expect, test } from "@playwright/test";

const classifications = ["HAMLET", "VILLAGE", "TOWN", "CITY", "METROPOLIS"] as const;
const sites = Array.from({ length: 400 }, (_, index) => {
  const ordinal = index + 1;
  const column = index % 40;
  const row = Math.floor(index / 40);
  return {
    classification: classifications[index % classifications.length],
    latticeId: `L${String((index % 10) + 1).padStart(2, "0")}`,
    latitude: ordinal >= 399 ? -80 : 81 - row * 18,
    longitude: ordinal >= 399 ? 170 : -175 + column * 9,
    regionId: ordinal === 243 ? "R10" : `R${String((index % 25) + 1).padStart(2, "0")}`,
    siteId: `SITE-${String(ordinal).padStart(4, "0")}`,
  };
});

test.beforeEach(async ({ page }) => {
  await page.route("**/api/auth/get-session", async (route) => {
    await route.fulfill({
      body: JSON.stringify({ session: { expiresAt: "2099-01-01T00:00:00.000Z", id: "atlas-session", token: "test-token", userId: "admin-1" }, user: { email: "admin@example.test", id: "admin-1", name: "Admin", role: "admin" } }),
      contentType: "application/json",
      status: 200,
    });
  });
  await page.route("**/api/atlas/catalog", async (route) => {
    await route.fulfill({
      body: JSON.stringify({ connections: [], coordinateReferenceSystem: "EPSG:4326", pointsOfInterest: [], regionMappings: [], releaseId: "R09-BROWSER", settlementSites: sites, worldId: "EIDOLON" }),
      contentType: "application/json",
      status: 200,
    });
  });
  await page.route("**/api/admin/settlements/?world=CONCORD", async (route) => {
    await route.fulfill({
      body: JSON.stringify({ settlements: sites.slice(0, 24).map((site, index) => ({
        settlement: { classification: site.classification, name: `Founded ${index + 1}`, settlementId: `SET-${String(index + 1).padStart(4, "0")}`, site },
        settlementWorldId: `SW-${String(index + 1).padStart(4, "0")}`,
        totalPopulation: 100,
        worldKey: "CONCORD",
      })) }),
      contentType: "application/json",
      status: 200,
    });
  });
});

test("400 Atlas Sites remain selectable through clustering, zoom, spiderfy, search, table, and world occupancy", async ({ page }) => {
  await page.goto("/admin/atlas/sites");
  await expect(page.getByText("400 of 400 Sites")).toBeVisible();

  const representedAtOne = await page.locator("button.map-data-cluster, button.map-data-pin").evaluateAll((markers) => markers.reduce((total, marker) => total + (marker.classList.contains("map-data-cluster") ? Number(marker.textContent) : 1), 0));
  expect(representedAtOne).toBe(400);
  const cluster = page.getByRole("button", { name: /Cluster containing \d+ Sites/ }).first();
  await expect(cluster).toBeVisible();
  await cluster.focus();
  await cluster.press("Enter");
  await expect(page.getByLabel("Map zoom")).toHaveText("2x");

  const viewport = page.getByTestId("atlas-map-viewport");
  await viewport.dispatchEvent("wheel", { deltaY: -100 });
  await expect(page.getByLabel("Map zoom")).toHaveText("3x");
  const box = await viewport.boundingBox();
  expect(box).not.toBeNull();
  await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
  await page.mouse.down();
  await page.mouse.move(box!.x + box!.width / 2 + 80, box!.y + box!.height / 2 + 40);
  await page.mouse.up();
  await expect(page.getByTestId("atlas-map-stage")).not.toHaveCSS("transform", "matrix(3, 0, 0, 3, 0, 0)");

  await page.getByRole("button", { name: "Reset map" }).click();
  await expect(page.getByLabel("Map zoom")).toHaveText("1x");
  for (let zoom = 2; zoom <= 6; zoom += 1) await page.getByRole("button", { name: "Zoom in" }).click();
  const coincidentCluster = page.getByRole("button", { name: "Cluster containing 2 Sites" });
  await expect(coincidentCluster).toBeVisible();
  await coincidentCluster.click();
  await expect(page.getByRole("button", { name: /Select SITE-0399/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /Select SITE-0400/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /Select SITE-0399/ })).toHaveAttribute("data-latitude", "-80");
  await expect(page.getByRole("button", { name: /Select SITE-0400/ })).toHaveAttribute("data-longitude", "170");

  await page.getByRole("button", { name: "Reset map" }).click();
  await page.getByLabel("Search Site ID").fill("0243");
  await page.getByLabel("Site search results").getByRole("button", { name: /SITE-0243/ }).click();
  await expect(page.getByRole("definition").filter({ hasText: "SITE-0243" })).toBeVisible();
  await page.getByRole("row", { name: /SITE-0243/ }).press("Enter");
  await expect(page.getByRole("row", { name: /SITE-0243/ })).toHaveClass(/selected-row/);

  await page.getByLabel("Current World context").selectOption("CONCORD");
  await expect(page.getByText(/24 founded in CONCORD/)).toBeVisible();
  await page.getByLabel("Occupancy").selectOption("FOUNDED");
  await expect(page.getByText("24 of 400 Sites")).toBeVisible();
  await page.getByRole("button", { name: "Clear Atlas filters" }).click();
  await page.getByLabel("Search Site ID").fill("SITE-0001");
  await page.getByLabel("Site search results").getByRole("button", { name: /SITE-0001/ }).click();
  await expect(page.getByText("Already founded")).toHaveAttribute("aria-disabled", "true");
  await expect(page.getByText("Already founded")).not.toHaveAttribute("href");
  await page.screenshot({ fullPage: false, path: "artifacts/release-0.3.0/atlas/atlas-sites-1600x900.png" });
});
