import { expect, test } from "@playwright/test";

test("Campaign Planner renders one card across its inclusive Book range", async ({ page }) => {
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
          placements: [{
            bookNumbers: [7, 8, 9, 10, 11, 12],
            campaignPlacementId: "six-book-browser-check",
            objectId: "LESSON-SIX-BOOKS",
            objectType: "LESSON",
          }],
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
});
