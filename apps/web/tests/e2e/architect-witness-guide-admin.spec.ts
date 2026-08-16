import { createHash } from "node:crypto";
import { readFileSync, rmSync } from "node:fs";
import { resolve } from "node:path";

import { expect, test, type Page } from "@playwright/test";

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

function capturePath(email: string): string {
  const identity = createHash("sha256").update(`${email.toLowerCase()}\0email-verification`).digest("hex");
  return resolve(captureDirectory, `${identity}.json`);
}

async function verificationCode(email: string): Promise<string> {
  let code = "";
  await expect.poll(() => {
    try {
      const capture = JSON.parse(readFileSync(capturePath(email), "utf8")) as { code?: unknown };
      code = typeof capture.code === "string" ? capture.code : "";
      return /^\d{6}$/.test(code);
    } catch {
      return false;
    }
  }).toBe(true);
  return code;
}

async function createOwner(page: Page) {
  const nonce = `canon-owner-${Date.now().toString(36)}-${Math.floor(Math.random() * 1_000).toString(36)}`;
  const account = { email: `${nonce}@example.test`, password: `Canonical-${nonce}-Password!`, username: nonce.replaceAll("-", "_") };
  rmSync(capturePath(account.email), { force: true });
  await page.goto("/auth/sign-up");
  await page.locator("html[data-hydrated=true]").waitFor();
  await page.getByLabel("Username").fill(account.username);
  await page.getByLabel("Email").fill(account.email);
  await page.getByLabel("Password").fill(account.password);
  await page.getByRole("radio", { name: "18 or older" }).check();
  await page.getByRole("button", { name: "Create Account" }).click();
  await page.getByLabel("Verification code").fill(await verificationCode(account.email));
  await page.getByRole("button", { name: "Verify Email" }).click();
  const database = await testDatabase();
  const user = await database.user.update({ where: { email: account.email }, data: { role: "owner" }, select: { id: true } });
  await page.goto("/auth/sign-in");
  await page.locator("html[data-hydrated=true]").waitFor();
  await page.getByLabel("Email").fill(account.email);
  await page.getByLabel("Password").fill(account.password);
  await page.getByRole("button", { name: "Sign In", exact: true }).click();
  await expect.poll(async () => (await page.request.get("/api/player/access")).status()).toBe(200);
  return { ...account, userId: user.id };
}

test("owner can use both Bulk API modes and reach campaign-owned document workflows", async ({ browser }) => {
  test.setTimeout(120_000);
  const context = await browser.newContext();
  const page = await context.newPage();
  const consoleErrors: string[] = [];
  const serverErrors: string[] = [];
  page.on("console", (message) => { if (message.type() === "error") consoleErrors.push(message.text()); });
  page.on("response", (response) => { if (response.status() >= 500) serverErrors.push(`${response.status()} ${response.url()}`); });
  let owner: Awaited<ReturnType<typeof createOwner>> | undefined;
  try {
    owner = await createOwner(page);
    const database = await testDatabase();

    const keyedResponse = await page.request.post("/api/admin/bulk-operations", { data: { action: "generate" } });
    expect(keyedResponse.status()).toBe(201);
    const keyed = await keyedResponse.json() as { sessionId: string };
    expect(await database.externalBulkApiSession.findUniqueOrThrow({ where: { externalBulkApiSessionId: keyed.sessionId } })).toMatchObject({ state: "KEYED" });
    expect(await (await page.request.get("/api/admin/bulk-operations")).json()).toMatchObject({ state: "KEYED" });
    expect((await page.request.post("/api/admin/bulk-operations", { data: { action: "revoke", sessionId: keyed.sessionId } })).ok()).toBe(true);

    const keylessResponse = await page.request.post("/api/admin/bulk-operations", { data: { action: "enable-keyless" } });
    expect(keylessResponse.status()).toBe(201);
    const keyless = await keylessResponse.json() as { sessionId: string };
    expect(await database.externalBulkApiSession.findUniqueOrThrow({ where: { externalBulkApiSessionId: keyless.sessionId } })).toMatchObject({ keyHash: null, state: "KEYLESS" });
    expect(await (await page.request.get("/api/admin/bulk-operations")).json()).toMatchObject({ state: "KEYLESS" });
    expect((await page.request.post("/api/admin/bulk-operations", { data: { action: "revoke", sessionId: keyless.sessionId } })).ok()).toBe(true);

    await page.goto("/admin/data/bulk-operations");
    await page.locator("html[data-hydrated=true]").waitFor();
    await expect(page.getByRole("heading", { name: "OFF" })).toBeVisible();
    await page.getByRole("button", { name: "Generate Key" }).click();
    await expect(page.getByText("Copy this temporary key now.")).toBeVisible();
    await expect(page.getByRole("heading", { name: "KEYED" })).toBeVisible();
    await expect.poll(async () => (await database.externalBulkApiSession.findFirst({ where: { issuedByUserId: owner!.userId, revokedAt: null } }))?.state).toBe("KEYED");

    await page.getByRole("button", { name: "Turn Off" }).click();
    await expect(page.getByRole("heading", { name: "OFF" })).toBeVisible();
    await page.getByRole("button", { name: "Enable Keyless" }).click();
    await expect(page.getByRole("heading", { name: "KEYLESS" })).toBeVisible();
    await expect.poll(async () => (await database.externalBulkApiSession.findFirst({ where: { issuedByUserId: owner!.userId, revokedAt: null } }))?.state).toBe("KEYLESS");
    await expect(page.locator(".notice--bad")).toHaveCount(0);
    await page.getByRole("button", { name: "Turn Off" }).click();
    await expect(page.getByRole("heading", { name: "OFF" })).toBeVisible();

    await page.goto("/admin/operations");
    await page.locator("html[data-hydrated=true]").waitFor();
    await expect(page.getByText("Select a bucket")).toHaveCount(0);
    await expect(page.getByLabel("Document bucket")).toHaveCount(0);
    await page.getByRole("link", { name: "Historical Document Corpus" }).click();
    await expect(page).toHaveURL(/\/admin\/campaigns\/current\/documents$/);
    await expect(page.getByText(/Checking account session/)).toHaveCount(0, { timeout: 15_000 });
    await expect(page.getByRole("heading", { name: "Campaign-owned document corpus" })).toBeVisible();
    await expect(page.getByText(/does not create a parallel document persistence model/)).toBeVisible();

    await page.goto("/admin/operations");
    await page.getByRole("link", { name: "Document Quest and Research Planner" }).click();
    await expect(page).toHaveURL(/\/admin\/campaigns\/current\/document-quests$/);
    await expect(page.getByText(/Checking account session/)).toHaveCount(0, { timeout: 15_000 });
    await expect(page.getByRole("heading", { name: "Campaign-owned research planning" })).toBeVisible();
    await expect(page.locator("select")).toHaveCount(0);
    expect(consoleErrors).toEqual([]);
    expect(serverErrors).toEqual([]);
  } finally {
    await context.close();
    if (owner) {
      const database = await testDatabase();
      await database.externalBulkApiSession.deleteMany({ where: { issuedByUserId: owner.userId } });
      await database.user.deleteMany({ where: { id: owner.userId } });
      await database.verification.deleteMany({ where: { identifier: { contains: owner.email } } });
      rmSync(capturePath(owner.email), { force: true });
    }
  }
});
