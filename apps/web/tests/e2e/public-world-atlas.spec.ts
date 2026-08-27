import { expect, test } from "@playwright/test";

test("public World Atlas renders the 24 Year-0 founding cities on 25 colored Regions", async ({ page }) => {
  test.setTimeout(300_000);
  await page.setViewportSize({ height: 900, width: 1600 });
  await page.goto("/gameplay/world-atlas");

  const globe = page.getByRole("application", { name: /Interactive Eidolon globe/ });
  await expect(globe).toBeVisible();
  await expect(page.getByText("24 original founding cities")).toBeVisible();
  const cities = page.locator("button[data-atlas-founding-city]");
  await expect(cities).toHaveCount(24, { timeout: 15_000 });
  await expect(page.locator('button[data-region-id="R10"]')).toHaveCount(0);
  await expect(page.getByText("Loading managed 3D globe texture…")).toBeHidden({ timeout: 30_000 });
  await expect(page.locator(".atlas-globe-message--error")).toHaveCount(0);

  const response = await page.request.get("/api/atlas/public");
  expect(response.ok()).toBe(true);
  const projection = await response.json();
  expect(projection.foundingCities).toHaveLength(24);
  expect(projection.regions).toContainEqual({ color: "#228B22", name: "Innerwood", regionId: "R10" });
  expect(projection.continents).toHaveLength(3);
  expect(projection.geographicPoints).toHaveLength(92);
  expect(projection).not.toHaveProperty("pointsOfInterest");

  const regionColors = page.getByRole("checkbox", { name: "Region colors" });
  const continentNames = page.getByRole("checkbox", { name: "Continent names" });
  const geographicNames = page.getByRole("checkbox", { name: "Geographic names" });
  await expect(regionColors).toBeChecked();
  await expect(continentNames).toBeChecked();
  await expect(geographicNames).toBeChecked();
  await expect(page.locator("[data-atlas-continent-label]")).toHaveCount(3);
  await expect(page.locator("[data-atlas-geographic-point]")).toHaveCount(92);
  await expect(page.locator('[data-atlas-geographic-point][data-label="Northern Ocean"]')).toHaveCount(1);
  await expect(page.locator('[data-atlas-geographic-point][data-label="Meridian Sea"]')).toHaveCount(1);

  await regionColors.uncheck();
  await expect(globe).toHaveAttribute("data-region-colors", "hidden");
  await regionColors.check();
  await expect(globe).toHaveAttribute("data-region-colors", "visible");
  await continentNames.uncheck();
  await expect(page.locator('[data-atlas-continent-label][data-layer-visible="false"]')).toHaveCount(3);
  await continentNames.check();
  expect(await page.locator("[data-atlas-continent-label]").evaluateAll((labels) => labels.some((label) => !(label as HTMLElement).hidden))).toBe(true);
  await geographicNames.uncheck();
  await expect(page.locator('[data-atlas-geographic-point][data-layer-visible="false"]')).toHaveCount(92);
  await geographicNames.check();

  const autoRotate = page.getByRole("checkbox", { name: "Auto rotate" });
  if (await autoRotate.isChecked()) await autoRotate.uncheck();
  const visibleCities = page.locator("button[data-atlas-founding-city]:visible");
  const first = visibleCities.first();
  const firstName = (await first.getAttribute("data-city-name"))!;
  await first.click();
  await expect(page.getByRole("heading", { name: firstName })).toBeVisible();

  const second = visibleCities.nth(1);
  const secondName = (await second.getAttribute("data-city-name"))!;
  await second.click();
  await expect(page.getByRole("heading", { name: secondName })).toBeVisible();

  const status = page.getByTestId("atlas-globe-status");
  const rotationBefore = await status.textContent();
  const emptyGlobePoint = () => globe.evaluate((surface) => {
    const rectangle = surface.getBoundingClientRect();
    const candidates = [[0.5, 0.5], [0.5, 0.65], [0.35, 0.5], [0.65, 0.5], [0.5, 0.35]];
    for (const [xRatio, yRatio] of candidates) {
      const x = rectangle.x + rectangle.width * xRatio!;
      const y = rectangle.y + rectangle.height * yRatio!;
      const target = document.elementFromPoint(x, y);
      if (target && !target.closest("button, a, [role='button']")) return { x, y };
    }
    throw new Error("The globe has no empty drag surface.");
  });
  const dragStart = await emptyGlobePoint();
  await page.mouse.move(dragStart.x, dragStart.y);
  await page.mouse.down();
  await page.mouse.move(dragStart.x + 120, dragStart.y - 35, { steps: 8 });
  await page.mouse.up();
  await expect(status).not.toHaveText(rotationBefore ?? "");
  const momentumStop = await emptyGlobePoint();
  await page.mouse.move(momentumStop.x, momentumStop.y);
  await page.mouse.down();
  await page.mouse.up();

  const afterRotationId = await cities.evaluateAll((controls) => {
    for (const control of controls as HTMLElement[]) {
      if (control.hidden) continue;
      const marker = control.querySelector<HTMLElement>(".atlas-founding-city-marker");
      if (!marker) continue;
      const rectangle = marker.getBoundingClientRect();
      const hit = document.elementFromPoint(rectangle.x + rectangle.width / 2, rectangle.y + rectangle.height / 2);
      if (control.contains(hit)) return control.dataset.locationId;
    }
    throw new Error("No post-rotation founding city is hit-testable.");
  });
  const afterRotationCity = page.locator(`button[data-location-id="${afterRotationId}"]`);
  const afterRotationName = (await afterRotationCity.getAttribute("data-city-name"))!;
  await page.locator(`button[data-location-id="${afterRotationId}"] .atlas-founding-city-marker`).click();
  await expect(page.getByRole("heading", { name: afterRotationName })).toBeVisible();
  expect(await cities.evaluateAll((controls) => controls.filter((control) => (control as HTMLElement).hidden).length)).toBeGreaterThan(0);

  await page.getByRole("button", { name: "Reset globe" }).click();
  const evidenceCity = page.locator('button[data-city-name="Whakareva"]');
  await expect(evidenceCity).toBeVisible();
  await evidenceCity.locator(".atlas-founding-city-marker").click();
  await expect(page.getByRole("heading", { name: "Whakareva" })).toBeVisible();
  const viewport = page.viewportSize()!;
  const globeBox = await globe.boundingBox();
  expect(globeBox).not.toBeNull();
  expect(Math.abs(globeBox!.x + globeBox!.width / 2 - viewport.width / 2)).toBeLessThan(45);
  expect(globeBox!.height).toBeGreaterThan(viewport.height * 0.55);
  expect(await page.locator(".public-page--atlas").evaluate((surface) => ({ clientHeight: surface.clientHeight, scrollHeight: surface.scrollHeight }))).toEqual(expect.objectContaining({
    clientHeight: expect.any(Number), scrollHeight: expect.any(Number),
  }));
  expect(await page.locator(".public-page--atlas").evaluate((surface) => surface.scrollHeight <= surface.clientHeight)).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollHeight <= window.innerHeight)).toBe(true);

  await globe.focus();
  let centeredContinent = false;
  for (let step = 0; step < 52 && !centeredContinent; step += 1) {
    centeredContinent = await page.locator("[data-atlas-continent-label]").evaluateAll((labels) => labels.some((label) => {
      const element = label as HTMLElement;
      const left = Number.parseFloat(element.style.left);
      return !element.hidden && left >= 40 && left <= 60;
    }));
    if (!centeredContinent) {
      await globe.press("ArrowRight");
      await page.waitForTimeout(40);
    }
  }
  expect(centeredContinent).toBe(true);
  const evidenceSelection = page.locator("button[data-atlas-founding-city]:visible").first();
  const evidenceSelectionName = (await evidenceSelection.getAttribute("data-city-name"))!;
  await evidenceSelection.click();
  await expect(page.getByRole("heading", { name: evidenceSelectionName })).toBeVisible();
  await page.screenshot({ fullPage: false, path: "artifacts/release-0.3.0/atlas/world-atlas-remediation-1600x900.png" });
});
