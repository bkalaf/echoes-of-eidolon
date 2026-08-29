import { expect, test } from "@playwright/test";

const captureRepositoryEvidence = process.env.EIDOLON_E2E_CAPTURE_REPOSITORY_EVIDENCE !== "0";

test("Campaign Planner renders authoritative contiguous and mirrored Book geometry", async ({ page }) => {
  await page.route("**/api/auth/get-session", async (route) => {
    await route.fulfill({
      body: JSON.stringify({
        session: { expiresAt: "2099-01-01T00:00:00.000Z", id: "session-1", token: "test-token", userId: "admin-1" },
        user: { email: "admin@example.test", id: "admin-1", name: "Admin", role: "admin" },
      }),
      contentType: "application/json",
      status: 200,
    });
  });
  await page.route("**/api/admin/campaign?world=CONCORD", async (route) => {
    await route.fulfill({
      body: JSON.stringify({
        campaign: {
          name: "Concord Campaign",
          placements: [
            {
              bookNumbers: [7, 8, 9, 10, 11, 12],
              campaignPlacementId: "six-book-browser-check",
              objectId: "LESSON-SIX-BOOKS",
              objectType: "LESSON",
            },
            {
              bookNumbers: [4, 15],
              campaignPlacementId: "mirrored-browser-check",
              objectId: "A",
              objectType: "COMPANION",
            },
          ],
        },
      }),
      contentType: "application/json",
      status: 200,
    });
  });

  await page.goto("/admin/campaign/planner?state=CAMPAIGN_CONCORD");
  const card = page.getByTestId("campaign-placement-six-book-browser-check");
  await expect(card).toHaveCount(1, { timeout: 15_000 });
  await expect(card).toBeVisible();
  await expect(card).toHaveAttribute("data-start-book", "7");
  await expect(card).toHaveAttribute("data-book-span", "6");
  await expect(card).toHaveCSS("grid-row-start", "8");
  await expect(card).toHaveCSS("grid-row-end", "span 6");

  const mirrored = page.locator('[data-logical-placement-id="mirrored-browser-check"]');
  await expect(mirrored).toHaveCount(2);
  await expect(mirrored.nth(0)).toHaveAttribute("data-start-book", "4");
  await expect(mirrored.nth(1)).toHaveAttribute("data-start-book", "15");
  await expect(mirrored.nth(0)).toHaveAttribute("data-book-span", "1");
  await expect(mirrored.nth(1)).toHaveAttribute("data-book-span", "1");
});

test("Campaign Planner reorders persistent cards with readable buttons, keyboard focus, and drag parity", async ({ page }) => {
  await page.route("**/api/auth/get-session", async (route) => {
    await route.fulfill({
      body: JSON.stringify({
        session: { expiresAt: "2099-01-01T00:00:00.000Z", id: "session-1", token: "test-token", userId: "admin-1" },
        user: { email: "admin@example.test", id: "admin-1", name: "Admin", role: "admin" },
      }),
      contentType: "application/json",
      status: 200,
    });
  });
  const original = [
    { bookNumbers: [2], campaignPlacementId: "placement-a", objectId: "WITNESS-A", objectType: "WITNESS", ordinal: 1 },
    { bookNumbers: [4], campaignPlacementId: "placement-b", objectId: "WITNESS-B", objectType: "WITNESS", ordinal: 2 },
    { bookNumbers: [6], campaignPlacementId: "placement-c", objectId: "WITNESS-C", objectType: "WITNESS", ordinal: 3 },
    { bookNumbers: [8], campaignPlacementId: "placement-d", objectId: "WITNESS-D", objectType: "WITNESS", ordinal: 4 },
  ];
  let placements = original.map((placement) => ({ ...placement, bookNumbers: [...placement.bookNumbers] }));
  const reorderRequests: Array<Record<string, string>> = [];
  await page.route("**/api/admin/campaign/reorder", async (route) => {
    const input = route.request().postDataJSON() as { beforeCampaignPlacementId?: string; campaignPlacementId: string; direction?: "UP" | "DOWN"; worldKey: string };
    reorderRequests.push(input as unknown as Record<string, string>);
    const from = placements.findIndex((placement) => placement.campaignPlacementId === input.campaignPlacementId);
    if (input.direction) {
      const to = from + (input.direction === "UP" ? -1 : 1);
      [placements[from], placements[to]] = [placements[to]!, placements[from]!];
    } else {
      const [moving] = placements.splice(from, 1);
      placements.splice(placements.findIndex((placement) => placement.campaignPlacementId === input.beforeCampaignPlacementId), 0, moving!);
    }
    placements = placements.map((placement, index) => ({ ...placement, ordinal: index + 1 }));
    await route.fulfill({ body: JSON.stringify({ campaignId: "campaign-1", placements }), contentType: "application/json", status: 200 });
  });
  await page.route("**/api/admin/campaign?world=RUIN", async (route) => {
    await route.fulfill({ body: JSON.stringify({ campaign: { name: "Ruin Campaign", placements }, unassigned: {} }), contentType: "application/json", status: 200 });
  });

  await page.goto("/admin/campaign/planner?state=CAMPAIGN_RUIN");
  const first = page.getByTestId("campaign-placement-placement-a");
  const second = page.getByTestId("campaign-placement-placement-b");
  const last = page.getByTestId("campaign-placement-placement-d");
  await expect(first.getByRole("button", { name: "↑ Move up" })).toHaveText("↑ Move up");
  await expect(first.getByRole("button", { name: "↓ Move down" })).toHaveText("↓ Move down");
  await expect(first.getByRole("button", { name: "↑ Move up" })).toBeDisabled();
  await expect(last.getByRole("button", { name: "↓ Move down" })).toBeDisabled();

  const down = second.getByRole("button", { name: "↓ Move down" });
  await down.click();
  await expect(page.getByTestId("campaign-placement-placement-b")).toHaveAttribute("data-campaign-position", "3");
  await expect(down).toBeFocused();
  await expect(page.getByRole("status")).toContainText("WITNESS-B moved to position 3 of 4 in Witness.");
  await page.reload();
  await expect(page.getByTestId("campaign-placement-placement-b")).toHaveAttribute("data-campaign-position", "3");

  const up = page.getByTestId("campaign-placement-placement-b").getByRole("button", { name: "↑ Move up" });
  await up.focus();
  await up.press("Enter");
  await expect(page.getByTestId("campaign-placement-placement-b")).toHaveAttribute("data-campaign-position", "2");
  await expect(up).toBeFocused();

  await page.getByRole("button", { name: "Drag WITNESS-C to reorder" }).dragTo(page.getByTestId("campaign-placement-placement-a"));
  await expect(page.getByTestId("campaign-placement-placement-c")).toHaveAttribute("data-campaign-position", "1");
  await page.reload();
  await expect(page.getByTestId("campaign-placement-placement-c")).toHaveAttribute("data-campaign-position", "1");
  expect(reorderRequests.some((request) => request.beforeCampaignPlacementId === "placement-a" && request.campaignPlacementId === "placement-c")).toBe(true);
  expect(placements.map(({ bookNumbers, campaignPlacementId, objectId }) => ({ bookNumbers, campaignPlacementId, objectId })).sort((left, right) => left.campaignPlacementId.localeCompare(right.campaignPlacementId))).toEqual(
    original.map(({ bookNumbers, campaignPlacementId, objectId }) => ({ bookNumbers, campaignPlacementId, objectId })).sort((left, right) => left.campaignPlacementId.localeCompare(right.campaignPlacementId)),
  );
});

test("Campaign Planner contains horizontal scrolling and keeps owner controls readable at 1600x900", async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 900 });
  await page.route("**/api/auth/get-session", async (route) => {
    await route.fulfill({
      body: JSON.stringify({ session: { expiresAt: "2099-01-01T00:00:00.000Z", id: "session-layout", token: "test-token", userId: "admin-1" }, user: { email: "admin@example.test", id: "admin-1", name: "Admin", role: "admin" } }),
      contentType: "application/json",
      status: 200,
    });
  });
  await page.route("**/api/admin/campaign?world=CONCORD", async (route) => {
    await route.fulfill({
      body: JSON.stringify({
        campaign: { name: "Concord Campaign", placements: [
          { bookNumbers: [2], campaignPlacementId: "layout-witness-a", label: "Mara Vale", objectId: "CHA_MARA_VALE", objectType: "WITNESS", ordinal: 1 },
          { bookNumbers: [4], campaignPlacementId: "layout-witness-b", label: "Iona Hart", objectId: "CHA_IONA_HART", objectType: "WITNESS", ordinal: 2 },
        ] },
        unassigned: {
          WITNESS: [{ label: "Nadia Okafor", objectId: "CHA_NADIA_OKAFOR", objectType: "WITNESS" }],
          ARCHITECT: [{ label: "Kris Maarja Tamm", objectId: "CHA_KRIS_MAARJA_TAMM", objectType: "ARCHITECT" }],
        },
      }),
      contentType: "application/json",
      status: 200,
    });
  });

  await page.goto("/admin/campaign/planner?state=CAMPAIGN_CONCORD");
  const title = page.getByRole("heading", { level: 1, name: "Main 18-Book Planner — Concord" });
  const viewport = page.getByTestId("campaign-board-viewport");
  const first = page.getByTestId("campaign-placement-layout-witness-a");
  await expect(first).toBeVisible();
  await expect(title).toBeVisible();
  const titleBefore = await title.boundingBox();
  expect(titleBefore).not.toBeNull();
  await expect(viewport).toHaveCSS("overflow-x", "auto");
  await viewport.evaluate((element) => { element.scrollLeft = 1200; });
  expect(await viewport.evaluate((element) => element.scrollLeft)).toBeGreaterThan(0);
  expect(await page.evaluate(() => document.documentElement.scrollLeft || document.body.scrollLeft)).toBe(0);
  const titleAfter = await title.boundingBox();
  expect(titleAfter?.x).toBe(titleBefore?.x);

  await expect(first.getByRole("button", { name: "↑ Move up" })).toHaveText("↑ Move up");
  await expect(first.getByRole("button", { name: "↓ Move down" })).toHaveText("↓ Move down");
  await expect(first.getByRole("button", { name: "↑ Move up" })).toBeDisabled();
  await expect(page.getByRole("option", { name: /Nadia Okafor/ })).toBeVisible();
  await expect(page.getByRole("option", { name: /Kris Maarja Tamm/ })).toBeVisible();
  if (captureRepositoryEvidence) await page.screenshot({ fullPage: false, path: "artifacts/release-0.3.0/campaign/campaign-planner-1600x900.png" });
});
