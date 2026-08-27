import { createHash } from "node:crypto";
import { readFileSync, rmSync } from "node:fs";
import { resolve } from "node:path";

import { expect, test, type Page } from "@playwright/test";

import { memberPuzzleSolvers } from "./support/member-puzzle-solvers";

const captureDirectory = "/tmp/echoes-e2e-auth-codes";
let databasePromise: Promise<Awaited<ReturnType<typeof import("../../src/server/database")["getDatabase"]>>> | undefined;

async function testDatabase() {
  if (!databasePromise) {
    if (!process.env.DATABASE_URL) {
      const repositoryRoot = resolve(process.cwd(), "../..");
      const config = JSON.parse(readFileSync(resolve(repositoryRoot, ".local/config.json"), "utf8")) as { credentialDirectory: string };
      process.env.DATABASE_URL = readFileSync(resolve(repositoryRoot, config.credentialDirectory, "database_url"), "utf8").trim();
    }
    databasePromise = import("../../src/server/database").then(({ getDatabase }) => getDatabase());
  }
  return databasePromise;
}

function capturePath(email: string) {
  const identity = createHash("sha256").update(`${email.toLowerCase()}\0email-verification`).digest("hex");
  return resolve(captureDirectory, `${identity}.json`);
}

async function createSignedInMemberWithoutGrant(page: Page) {
  const nonce = `member-puzzle-${Date.now().toString(36)}-${Math.floor(Math.random() * 1_000).toString(36)}`;
  const account = { email: `${nonce}@example.test`, password: `Member-${nonce}-Password!`, username: nonce.replaceAll("-", "_") };
  rmSync(capturePath(account.email), { force: true });
  await page.goto("/auth/sign-up");
  await page.locator("html[data-hydrated=true]").waitFor();
  await page.getByLabel("Username").fill(account.username);
  await page.getByLabel("Email").fill(account.email);
  await page.getByLabel("Password").fill(account.password);
  await page.getByRole("radio", { name: "18 or older" }).check();
  await page.getByRole("button", { name: "Create Account" }).click();
  let code = "";
  await expect.poll(() => { try { code = (JSON.parse(readFileSync(capturePath(account.email), "utf8")) as { code?: string }).code ?? ""; return /^\d{6}$/.test(code); } catch { return false; } }).toBe(true);
  await page.getByLabel("Verification code").fill(code);
  await page.getByRole("button", { name: "Verify Email" }).click();
  const database = await testDatabase();
  const user = await database.user.update({ where: { email: account.email }, data: { role: "member" }, select: { id: true } });
  await page.goto("/auth/sign-in?returnTo=%2F");
  await page.locator("html[data-hydrated=true]").waitFor();
  await page.getByLabel("Email").fill(account.email);
  await page.getByLabel("Password").fill(account.password);
  await page.getByRole("button", { name: "Sign In", exact: true }).click();
  await expect(page).toHaveURL(/\/$/);
  return { ...account, userId: user.id };
}

test("authorized operational account opens the four-only hub and solves all canonical puzzle surfaces", async ({ browser }) => {
  test.setTimeout(360_000);
  const context = await browser.newContext();
  const page = await context.newPage();
  let principal: Awaited<ReturnType<typeof createSignedInMemberWithoutGrant>> | undefined;
  try {
    expect((await page.request.get("/api/member/puzzles")).status()).toBe(401);
    principal = await createSignedInMemberWithoutGrant(page);
    expect((await page.request.get("/api/member/puzzles")).status()).toBe(403);
    const forbiddenPage = await page.goto("/puzzles");
    expect(forbiddenPage?.status()).toBe(403);
    await expect(page.getByRole("heading", { name: "Access unavailable" })).toBeVisible();

    const database = await testDatabase();
    await database.user.update({ where: { id: principal.userId }, data: { role: "owner" } });

    await page.goto("/");
    await page.locator("html[data-hydrated=true]").waitFor();
    await expect(page.getByRole("link", { name: "Puzzles" })).toBeVisible();
    await page.getByRole("link", { name: "Puzzles" }).click();
    await expect(page).toHaveURL(/\/puzzles\/?$/);
    await page.locator("html[data-hydrated=true]").waitFor();
    const cards = page.locator(".member-puzzle-card");
    await expect(cards).toHaveCount(4);
    await expect(cards.getByRole("heading")).toHaveText(["The Quiet Accord", "The Third Reading", "The Pall", "Glass Vespers"]);
    await expect(page.locator("body")).not.toContainText("PZB-");
    const catalogText = await (await page.request.get("/api/member/puzzles")).text();
    expect(JSON.parse(catalogText)).toHaveLength(4);
    expect(catalogText).not.toMatch(/PZB-|generatorVersion|canonicalSolution|instanceId|checksum|proof|expectedSolvePath/i);
    expect((await page.request.get("/api/member/puzzles/PZB-011")).status()).toBe(404);
    expect((await page.request.get("/api/member/puzzles/missing-commas-almanac")).status()).toBe(404);

    for (const [slug, title] of [
      ["quiet-accord", "The Quiet Accord"], ["third-reading", "The Third Reading"], ["the-pall", "The Pall"], ["glass-vespers", "Glass Vespers"],
    ] as const) {
      const card = cards.filter({ hasText: title });
      await card.getByRole("link", { name: "Open" }).click();
      await expect(page).toHaveURL(new RegExp(`/puzzles/${slug}$`));
      await page.locator("html[data-hydrated=true]").waitFor();
      const surface = page.getByRole("article", { name: `${title} player puzzle` });
      const payload = await (await page.request.get(`/api/member/puzzles/${slug}`)).text();
      expect(payload).not.toMatch(/PZB-|generatorVersion|canonicalSolution|instanceId|checksum|proofDigest|expectedSolvePath|carrier|encodedValue|decodeOffset|moduleMatrixTable/i);
      await surface.getByRole("button", { name: "Hint 1" }).click();
      await expect(surface.getByRole("region", { name: "Puzzle hints" }).locator("p.notice", { hasText: "Hint 1" })).toBeVisible();
      await surface.getByRole("button", { name: "Hint 2" }).click();
      await expect(surface.getByRole("region", { name: "Puzzle hints" }).locator("p.notice", { hasText: "Hint 2" })).toBeVisible();
      await memberPuzzleSolvers[slug](surface);
      await page.screenshot({ path: `/tmp/echoes-member-${slug}.png` });
      await page.getByRole("link", { name: "All puzzles" }).click();
      await expect(page).toHaveURL(/\/puzzles\/?$/);
      await page.locator("html[data-hydrated=true]").waitFor();
    }

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/puzzles/glass-vespers");
    await page.locator("html[data-hydrated=true]").waitFor();
    const mobileSurface = page.getByRole("article", { name: "Glass Vespers player puzzle" });
    await expect(mobileSurface.locator(".puzzle-score-page").first()).toBeVisible();
    await mobileSurface.getByLabel("Retained notes per pane").selectOption("6");
    await mobileSurface.getByLabel("Control separator").selectOption("G");
    await expect(mobileSurface.getByRole("img", { name: "Developed 32 by 4 glass pane" })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBe(true);
  } finally {
    await context.close().catch(() => undefined);
    if (principal) {
      const database = await testDatabase();
      await database.$transaction([database.verification.deleteMany({ where: { identifier: { contains: principal.email } } }), database.user.deleteMany({ where: { id: principal.userId } })]);
      rmSync(capturePath(principal.email), { force: true });
    }
  }
});
