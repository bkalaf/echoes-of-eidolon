import { expect, test } from "@playwright/test";

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
  await expect(card).toHaveCount(1);
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
