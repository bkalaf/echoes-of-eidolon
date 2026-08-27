import { expect, test } from "@playwright/test";

test("public World Atlas renders the 24 Year-0 founding cities on 25 colored Regions", async ({ page }) => {
  test.setTimeout(90_000);
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
  expect(projection.regions).toContainEqual({ color: "#E66A00", name: "Innerwood", regionId: "R10" });
  expect(projection).not.toHaveProperty("pointsOfInterest");

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
  await page.locator(".public-page").evaluate((surface) => surface.scrollTo(0, 0));
  await page.screenshot({ fullPage: false, path: "artifacts/release-0.3.0/atlas/world-atlas-remediation-1600x900.png" });
});
