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

async function createOwner(page: Page) {
  const nonce = `puzzle-${Date.now().toString(36)}-${Math.floor(Math.random() * 1_000).toString(36)}`;
  const account = { email: `${nonce}@example.test`, password: `Puzzle-${nonce}-Password!`, username: nonce.replaceAll("-", "_") };
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
  const user = await database.user.update({ where: { email: account.email }, data: { betaEligible: true, role: "owner" }, select: { id: true } });
  await page.goto("/auth/sign-in?returnTo=%2Fadmin%2Fpuzzles%2Ftest-lab");
  await page.locator("html[data-hydrated=true]").waitFor();
  await page.getByLabel("Email").fill(account.email);
  await page.getByLabel("Password").fill(account.password);
  await page.getByRole("button", { name: "Sign In", exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/puzzles\/test-lab$/);
  await page.locator("html[data-hydrated=true]").waitFor();
  return { ...account, userId: user.id };
}

test("owner QA reuses all four canonical Member renderers with privileged reveal", async ({ browser }) => {
  test.setTimeout(300_000);
  const context = await browser.newContext();
  const page = await context.newPage();
  let principal: Awaited<ReturnType<typeof createOwner>> | undefined;
  try {
    expect([401, 403]).toContain((await page.request.post("/api/admin/puzzles/solution", { data: { generation: 0, puzzleBlueprintId: "PZB-011" } })).status());
    principal = await createOwner(page);
    const database = await testDatabase();
    await database.user.update({ where: { id: principal.userId }, data: { role: "admin" } });
    expect((await page.request.post("/api/admin/puzzles/solution", { data: { generation: 0, puzzleBlueprintId: "PZB-011" } })).status()).toBe(403);
    await database.user.update({ where: { id: principal.userId }, data: { role: "owner" } });

    const payload = await (await page.request.get("/api/admin/puzzles/preview")).text();
    expect(payload).not.toMatch(/"(?:canonicalSolution|expectedSolution|proofDigest|instanceChecksum|encodedValue|decodeOffset|moduleMatrixTable)"\s*:/i);

    for (const [puzzleBlueprintId, publicSlug] of [
      ["PZB-011", "quiet-accord"], ["PZB-012", "third-reading"], ["PZB-021", "the-pall"], ["PZB-037", "glass-vespers"],
    ] as const) {
      await page.getByLabel("Puzzle Blueprint").selectOption(puzzleBlueprintId);
      const surface = page.getByRole("article", { name: /player puzzle$/ });
      await expect(surface).toHaveAttribute("aria-label", new RegExp(`${puzzleBlueprintId === "PZB-011" ? "Quiet Accord" : puzzleBlueprintId === "PZB-012" ? "Third Reading" : puzzleBlueprintId === "PZB-021" ? "The Pall" : "Glass Vespers"} player puzzle`));
      await surface.getByRole("button", { name: "Hint 1" }).click();
      await expect(surface.getByRole("region", { name: "Puzzle hints" }).locator("p.notice", { hasText: "Hint 1" })).toBeVisible();
      await surface.getByRole("button", { name: "Hint 2" }).click();
      await expect(surface.getByRole("region", { name: "Puzzle hints" }).locator("p.notice", { hasText: "Hint 2" })).toBeVisible();
      await memberPuzzleSolvers[publicSlug](surface);
      await expect(page.getByRole("heading", { name: "Validation history" }).locator("..")).toContainText("Correct");

      if (puzzleBlueprintId === "PZB-011") {
        await page.emulateMedia({ media: "print" });
        await expect(page.getByLabel("Owner puzzle QA panel")).toBeHidden();
        await expect(surface.getByRole("table", { name: "Record A" })).toBeVisible();
        await expect(surface.getByRole("table", { name: "Record B" })).toBeVisible();
        await expect(surface.getByRole("region", { name: "Printable cancellation worksheet" })).toBeVisible();
        await page.emulateMedia({ media: "screen" });
      }
      await page.locator(".production-puzzle-qa").screenshot({ path: `/tmp/echoes-production-${puzzleBlueprintId.toLowerCase()}-qa.png` });
      await page.getByRole("button", { name: "Reveal expected solution" }).click();
      await expect(page.getByRole("region", { name: "Privileged expected solution" })).toBeVisible();
      await page.getByRole("button", { name: "Reset player surface" }).click();
      await expect(page.getByText("Player progress reset.", { exact: true })).toBeVisible();
      const instance = page.getByLabel("Owner puzzle QA panel").locator("dt", { hasText: "Current instance" }).locator("xpath=following-sibling::dd[1]");
      const previousInstance = await instance.innerText();
      await page.getByRole("button", { name: "Regenerate instance" }).click();
      await expect(page.getByText("A new deterministic sandbox instance is ready.", { exact: true })).toBeVisible();
      await expect(instance).not.toHaveText(previousInstance);
    }
  } finally {
    await context.close().catch(() => undefined);
    if (principal) {
      const database = await testDatabase();
      await database.$transaction([database.verification.deleteMany({ where: { identifier: { contains: principal.email } } }), database.user.deleteMany({ where: { id: principal.userId } })]);
      rmSync(capturePath(principal.email), { force: true });
    }
  }
});
