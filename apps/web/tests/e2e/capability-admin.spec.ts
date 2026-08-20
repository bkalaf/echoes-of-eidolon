import { expect, test } from "@playwright/test";

test("Capability Registry renders the persisted versioned authority", async ({ page }) => {
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
  await page.route("**/api/admin/capabilities", async (route) => {
    await route.fulfill({
      body: JSON.stringify({
        definitions: [{
          capabilityDefinitionId: "CAP-LOCATION-DISCOVERED",
          code: "LOCATION_DISCOVERED",
          versions: [{
            capabilityDefinitionVersionId: "CAP-LOCATION-DISCOVERED:v1",
            version: 1,
            pathPattern: "location.{SITE}.discovered",
            valueKind: "BOOLEAN",
            minValue: null,
            maxValue: null,
            enumValues: [],
            allowedReferenceEntityTypes: [],
            allowedOperations: ["SET", "CLEAR"],
            monotonicPolicy: "TRUE_ONLY",
            description: "Discovery state.",
            status: "ACTIVE",
            parameters: [{ name: "SITE", kind: "ENTITY", entityType: "SITE", allowedValues: [], ordinal: 0 }],
          }],
        }],
      }),
      contentType: "application/json",
      status: 200,
    });
  });

  await page.goto("/admin/capabilities");
  await expect(page.getByRole("heading", { level: 1, name: "Capability Registry" })).toBeVisible();
  await expect(page.getByRole("cell", { name: "LOCATION_DISCOVERED" })).toBeVisible();
  await expect(page.getByText("v1 · ACTIVE")).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Capability administration" })).toContainText("Condition Builder");
  await expect(page.getByRole("link", { name: "Edit / versions" })).toHaveAttribute("href", "/admin/capabilities/CAP-LOCATION-DISCOVERED");
});
