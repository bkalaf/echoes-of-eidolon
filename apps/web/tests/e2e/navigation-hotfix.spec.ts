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

async function createSignedInPrincipal(page: Page, role: "user" | "member" | "admin" | "owner", betaEligible: boolean) {
  const nonce = `nav-${role[0]}${betaEligible ? "b" : "n"}-${Date.now().toString(36)}-${Math.floor(Math.random() * 1_000).toString(36)}`;
  const account = {
    email: `${nonce}@example.test`,
    password: `Navigation-${nonce}-Password!`,
    username: nonce.replaceAll("-", "_"),
  };
  rmSync(capturePath(account.email), { force: true });
  await page.goto("/auth/sign-up");
  await page.locator("html[data-hydrated=true]").waitFor();
  await page.getByLabel("Username").fill(account.username);
  await page.getByLabel("Email").fill(account.email);
  await page.getByLabel("Password").fill(account.password);
  await page.getByRole("radio", { name: "18 or older" }).check();
  await page.getByRole("button", { name: "Create Account" }).click();
  await expect(page.getByRole("dialog", { name: "Check your email." })).toBeVisible();
  await page.getByLabel("Verification code").fill(await verificationCode(account.email));
  await page.getByRole("button", { name: "Verify Email" }).click();
  const database = await testDatabase();
  const user = await database.user.update({
    where: { email: account.email },
    data: { betaEligible, role },
    select: { id: true },
  });
  await page.goto("/auth/sign-in?returnTo=%2F");
  await page.locator("html[data-hydrated=true]").waitFor();
  await page.getByLabel("Email").fill(account.email);
  await page.getByLabel("Password").fill(account.password);
  await expect(page.getByLabel("Email")).toHaveValue(account.email);
  await expect(page.getByLabel("Password")).toHaveValue(account.password);
  await page.getByRole("button", { name: "Sign In", exact: true }).click();
  await expect.poll(async () => (await page.request.get("/api/player/access")).status()).toBe(200);
  await page.reload();
  await page.locator("html[data-hydrated=true]").waitFor();
  return { ...account, userId: user.id };
}

async function deletePrincipal(input: { email: string; userId: string }) {
  const database = await testDatabase();
  await database.$transaction([
    database.user.deleteMany({ where: { id: input.userId } }),
    database.verification.deleteMany({ where: { identifier: { contains: input.email } } }),
  ]);
  rmSync(capturePath(input.email), { force: true });
}

async function expectHome(page: Page) {
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("heading", { name: /when the moons align/i })).toBeVisible();
}

test.describe("P0 role-aware navigation", () => {
  test("guest sees only public Home and authentication destinations", async ({ page }) => {
    await page.goto("/");
    await expectHome(page);
    const logo = page.getByRole("link", { name: "Echoes of Eidolon home" });
    await logo.focus();
    await expect(logo).toBeFocused();
    await page.keyboard.press("Enter");
    await expectHome(page);
    await expect(page.getByRole("link", { name: "Sign In" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Sign Up" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Account", exact: true })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Administration" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Enter Game" })).toHaveCount(0);
  });

  for (const fixture of [
    { betaEligible: false, role: "user" },
    { betaEligible: false, role: "member" },
    { betaEligible: false, role: "admin" },
    { betaEligible: false, role: "owner" },
    { betaEligible: true, role: "user" },
    { betaEligible: true, role: "admin" },
    { betaEligible: true, role: "owner" },
  ] as const) {
    test(`${fixture.role} with beta=${fixture.betaEligible} sees and can use only authorized destinations`, async ({ browser }) => {
      test.setTimeout(120_000);
      const context = await browser.newContext();
      const page = await context.newPage();
      const brokenDocuments: string[] = [];
      page.on("response", (response) => {
        if (response.request().resourceType() === "document" && [403, 404].includes(response.status())) {
          brokenDocuments.push(`${response.status()} ${response.url()}`);
        }
      });
      let principal: Awaited<ReturnType<typeof createSignedInPrincipal>> | undefined;
      try {
        principal = await createSignedInPrincipal(page, fixture.role, fixture.betaEligible);
        await expectHome(page);
        await expect(page.getByRole("heading", { name: "Player eligibility required" })).toHaveCount(0);
        await expect(page.getByRole("link", { name: "Account", exact: true })).toBeVisible();
        await expect(page.getByRole("link", { name: "Sign Out" })).toBeVisible();

        const administrative = fixture.role === "admin" || fixture.role === "owner";
        await expect(page.getByRole("link", { name: "Administration" })).toHaveCount(administrative ? 1 : 0);
        await expect(page.getByRole("link", { name: "Enter Game" })).toHaveCount(fixture.betaEligible ? 1 : 0);

        await page.getByRole("link", { name: "Account", exact: true }).click();
        await expect(page).toHaveURL(/\/account\/profile$/);
        const accountLogo = page.getByRole("link", { name: "Echoes of Eidolon home" });
        await accountLogo.focus();
        await expect(accountLogo).toBeFocused();
        await page.keyboard.press("Enter");
        await expectHome(page);

        if (administrative) {
          await page.getByRole("link", { name: "Administration" }).click();
          await expect(page).toHaveURL(/\/admin$/);
          await expect(page.getByRole("link", { name: "Account", exact: true })).toBeVisible();
          const administrationLogo = page.getByRole("link", { name: "Echoes of Eidolon home" });
          await administrationLogo.focus();
          await page.keyboard.press("Enter");
          await expectHome(page);
          await page.getByRole("link", { name: "Account", exact: true }).click();
          await page.getByRole("link", { name: "Home", exact: true }).click();
          await expectHome(page);
          await page.getByRole("link", { name: "Administration" }).click();
          await page.getByRole("link", { name: "Home", exact: true }).click();
          await expectHome(page);
        }

        if (fixture.betaEligible) {
          await page.getByRole("link", { name: "Enter Game" }).click();
          await expect(page).toHaveURL(/\/game$/);
          await page.getByRole("navigation", { name: "Site navigation" }).getByRole("link", { name: "Home" }).click();
          await expectHome(page);
        }

        if (fixture.role === "owner" && fixture.betaEligible) {
          await page.getByRole("link", { name: "Sign Out" }).click();
          await page.getByRole("button", { name: "Sign Out", exact: true }).click();
          await page.getByRole("link", { name: "Echoes of Eidolon home" }).click();
          await expectHome(page);
          await expect(page.getByRole("link", { name: "Sign In" })).toBeVisible();
        }
        expect(brokenDocuments).toEqual([]);
      } finally {
        await context.close();
        if (principal) await deletePrincipal(principal);
      }
    });
  }
});
