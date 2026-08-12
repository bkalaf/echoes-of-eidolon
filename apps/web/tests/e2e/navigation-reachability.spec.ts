import { createHash } from "node:crypto";
import { readFileSync, rmSync } from "node:fs";
import { resolve } from "node:path";

import { expect, test, type Page } from "@playwright/test";

const registry = JSON.parse(readFileSync(resolve(import.meta.dirname, "../../src/data/navigation-registry.generated.json"), "utf8")) as {
  activeScreenCount: number;
  statusCounts: Record<string, number>;
  rows: Array<{ automatedCoverage: string[]; routeRegistered: boolean }>;
};
const captureDirectory = "/tmp/echoes-e2e-auth-codes";
let databasePromise: Promise<Awaited<ReturnType<typeof import("../../src/server/database")["getDatabase"]>>> | undefined;

async function testDatabase() {
  databasePromise ??= import("../../src/server/database").then(({ getDatabase }) => getDatabase());
  return databasePromise;
}

function capturePath(email: string) {
  const identity = createHash("sha256").update(`${email.toLowerCase()}\0email-verification`).digest("hex");
  return resolve(captureDirectory, `${identity}.json`);
}

async function createOwner(page: Page) {
  const nonce = `reach-${Date.now().toString(36)}-${Math.floor(Math.random() * 1000).toString(36)}`;
  const account = { email: `${nonce}@example.test`, password: `Reach-${nonce}-Password!`, username: nonce.replaceAll("-", "_") };
  rmSync(capturePath(account.email), { force: true });
  await page.goto("/auth/sign-up"); await page.locator("html[data-hydrated=true]").waitFor();
  await page.getByLabel("Username").fill(account.username); await page.getByLabel("Email").fill(account.email); await page.getByLabel("Password").fill(account.password); await page.getByRole("radio", { name: "18 or older" }).check(); await page.getByRole("button", { name: "Create Account" }).click();
  let code = "";
  await expect.poll(() => { try { const record = JSON.parse(readFileSync(capturePath(account.email), "utf8")) as { code?: string }; code = record.code ?? ""; return /^\d{6}$/.test(code); } catch { return false; } }).toBe(true);
  await page.getByLabel("Verification code").fill(code); await page.getByRole("button", { name: "Verify Email" }).click();
  const database = await testDatabase();
  const user = await database.user.update({ where: { email: account.email }, data: { betaEligible: true, role: "owner" }, select: { id: true } });
  await page.goto("/auth/sign-in?returnTo=%2F"); await page.locator("html[data-hydrated=true]").waitFor(); await page.getByLabel("Email").fill(account.email); await page.getByLabel("Password").fill(account.password); await page.getByRole("button", { name: "Sign In", exact: true }).click();
  await expect.poll(async () => (await page.request.get("/api/player/access")).status()).toBe(200);
  return { ...account, userId: user.id };
}

async function crawlDirectory(page: Page, label: string) {
  await page.getByText(label, { exact: true }).click();
  const links = page.getByRole("navigation", { name: label }).getByRole("link");
  const hrefs = await links.evaluateAll((nodes) => [...new Set(nodes.map((node) => (node as HTMLAnchorElement).getAttribute("href")).filter((href): href is string => Boolean(href)))]);
  for (const href of hrefs) { const response = await page.request.get(href); expect([403, 404], `${label}: ${href} returned ${response.status()}`).not.toContain(response.status()); }
  return hrefs.length;
}

test("generated navigation registry has no active orphan, dead-end, or broken-link screens", () => {
  expect(registry.activeScreenCount).toBe(298);
  expect(registry.statusCounts.ORPHANED).toBe(0);
  expect(registry.statusCounts.DEAD_END).toBe(0);
  expect(registry.statusCounts.BROKEN_LINK).toBe(0);
  expect(registry.rows.every((row) => row.routeRegistered && row.automatedCoverage.includes("tests/e2e/navigation-reachability.spec.ts"))).toBe(true);
});

test("guest can crawl every visible public-directory link without 403 or 404", async ({ page }) => {
  await page.goto("/");
  await page.locator("html[data-hydrated=true]").waitFor();
  expect(await crawlDirectory(page, "Public page directory")).toBeGreaterThan(40);
});

test("eligible owner crawls Account, Administration, and Game directories through authorized UI", async ({ browser }) => {
  test.setTimeout(120_000);
  const context = await browser.newContext(); const page = await context.newPage(); let principal: Awaited<ReturnType<typeof createOwner>> | undefined;
  try {
    principal = await createOwner(page);
    await page.goto("/account/profile"); await page.locator("html[data-hydrated=true]").waitFor(); expect(await crawlDirectory(page, "Account page directory")).toBeGreaterThan(15);
    await page.getByRole("link", { name: "Administration" }).click(); await page.locator("html[data-hydrated=true]").waitFor(); expect(await crawlDirectory(page, "Administration page directory")).toBeGreaterThan(140);
    await page.getByRole("link", { name: "Enter Game" }).click(); await page.locator("html[data-hydrated=true]").waitFor(); expect(await crawlDirectory(page, "Game screen directory")).toBeGreaterThan(30);
  } finally {
    await context.close();
    if (principal) { const database = await testDatabase(); await database.$transaction([database.verification.deleteMany({ where: { identifier: { contains: principal.email } } }), database.user.deleteMany({ where: { id: principal.userId } })]); rmSync(capturePath(principal.email), { force: true }); }
  }
});
