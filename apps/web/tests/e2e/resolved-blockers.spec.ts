import { expect, test } from "@playwright/test";

async function waitForHydration(page: import("@playwright/test").Page) {
  await expect(page.locator("html")).toHaveAttribute("data-hydrated", "true");
}

const legalDocuments = [
  ["terms-of-service", "Terms of Service"], ["privacy", "Privacy Policy"], ["cookies", "Cookie Policy"],
  ["accessibility", "Accessibility Statement"], ["player-conduct", "Acceptable Use and Player Conduct"],
  ["beta-terms", "Beta and Invitation Participation Terms"], ["membership", "Membership and Subscription Terms"],
  ["support", "Donations and Perks Terms"], ["store-terms", "Store Terms of Sale"],
  ["shipping", "Shipping and Fulfillment Policy"], ["refunds", "Returns, Refunds, and Cancellation Policy"],
  ["ip-and-fan-content", "Intellectual Property and Fan Content Policy"],
  ["ai-disclosure", "AI, Automated Interaction, and Player Content Disclosure"],
  ["cultural-research", "Cultural Use, Attribution, and Research Corrections Policy"],
] as const;

test("the exact fourteen owner-approved legal documents render without publication promotion", async ({ page }) => {
  test.slow();
  await page.goto("/legal");
  await expect(page.locator(".legal-grid a")).toHaveCount(14);
  await expect(page.getByText("OWNER APPROVED — 0.2.0", { exact: true })).toBeVisible();
  await expect(page.getByText("NOT PUBLISHED — DEPLOYMENT AUTHORIZATION NOT GRANTED", { exact: true })).toBeVisible();
  for (const [slug, title] of legalDocuments) {
    await page.goto(`/legal/${slug}`);
    await expect(page.getByRole("heading", { level: 1, name: title }).first()).toBeVisible();
    await expect(page.getByRole("heading", { name: "Plain-language summary" })).toBeVisible();
    await expect(page.getByText("NOT PUBLISHED — DEPLOYMENT AUTHORIZATION NOT GRANTED", { exact: true })).toBeVisible();
  }
});

test("ORDER-001 guest lookup and token status remain privacy-safe", async ({ page }) => {
  await page.route("**/api/store/order-lookup", (route) => route.fulfill({ json: { message: "If the order details match, a private status link has been sent." }, status: 202 }));
  await page.goto("/store/order-lookup");
  await waitForHydration(page);
  await page.getByLabel("Order number").fill("ORDER-1");
  await page.getByLabel("Receipt email").fill("guest@example.test");
  await page.getByRole("button", { name: "Email private status link" }).click();
  await expect(page.getByRole("status")).toHaveText("If the order details match, a private status link has been sent.");

  await page.route("**/api/store/orders/private-token", (route) => route.fulfill({ json: { order: {
    createdAt: "2027-01-01T00:00:00.000Z", fulfillment: { submittedAt: "2027-01-01T00:02:00.000Z" },
    items: [{ color: "Blue", name: "Mug", orderLineId: "LINE-1", quantity: 1, size: null, unitPriceCents: 2500 }],
    orderId: "ORDER-1", payment: { amountCents: 2500, confirmedAt: "2027-01-01T00:01:00.000Z" }, refundedAmountCents: 0, shippingSummary: { city: "San Diego", country: "US" },
  } } }));
  await page.goto("/store/orders/private-token");
  await expect(page.getByRole("heading", { name: "Order ORDER-1" })).toBeVisible();
  await expect(page.getByText(/Sent to fulfillment/)).toBeVisible();
  await expect(page.getByText(/card|guest@example|stripe_/i)).not.toBeVisible();
});

test("SUPPORT-001 Store Support submits intake without claiming a refund", async ({ page }) => {
  await page.route("**/api/store/support", (route) => route.fulfill({ json: { ticket: { helpTicketId: "TICKET-1", messages: [{ createdAt: "2027-01-01T00:00:00.000Z", message: "Photo attached" }] } }, status: 201 }));
  await page.goto("/store/support");
  await waitForHydration(page);
  await page.getByLabel("Order number").fill("ORDER-1");
  await page.getByLabel("Subject").fill("Damaged mug");
  await page.getByLabel("Message").fill("The mug arrived damaged.");
  await page.getByRole("button", { name: "Submit support request" }).click();
  await expect(page.getByRole("heading", { name: "Request received" })).toBeVisible();
  await expect(page.getByText(/No refund or replacement has been issued automatically/)).toBeVisible();
  await expect(page.getByRole("heading", { name: "Communication history" })).toBeVisible();
});
