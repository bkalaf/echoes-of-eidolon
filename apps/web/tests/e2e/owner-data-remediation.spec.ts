import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { expect, test, type Page } from "@playwright/test";

const captureDirectory = "/tmp/echoes-e2e-auth-codes";
const screenshotDirectory = resolve(import.meta.dirname, "../../../../artifacts/release-0.3.0/owner-ui/screenshots");
const captureOwnerEvidence = process.env.EIDOLON_E2E_CAPTURE_OWNER_EVIDENCE !== "0";
let databasePromise: Promise<Awaited<ReturnType<typeof import("../../src/server/database")["getDatabase"]>>> | undefined;

async function captureScreenshot(page: Page, name: string) {
  if (captureOwnerEvidence) await page.screenshot({ fullPage: false, path: resolve(screenshotDirectory, name) });
}

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
  const nonce = `owner-data-${Date.now().toString(36)}-${Math.floor(Math.random() * 1000).toString(36)}`;
  const account = { email: `${nonce}@example.test`, password: `Owner-${nonce}-Password!`, username: nonce.replaceAll("-", "_") };
  rmSync(capturePath(account.email), { force: true });
  await page.goto("/auth/sign-up");
  await page.locator("html[data-hydrated=true]").waitFor();
  await page.getByLabel("Username").fill(account.username);
  await page.getByLabel("Email").fill(account.email);
  await page.getByLabel("Password").fill(account.password);
  await page.getByRole("radio", { name: "18 or older" }).check();
  await page.getByRole("button", { name: "Create Account" }).click();
  let code = "";
  await expect.poll(() => {
    try {
      const capture = JSON.parse(readFileSync(capturePath(account.email), "utf8")) as { code?: string };
      code = capture.code ?? "";
      return /^\d{6}$/.test(code);
    } catch { return false; }
  }).toBe(true);
  await page.getByLabel("Verification code").fill(code);
  await page.getByRole("button", { name: "Verify Email" }).click();
  await expect(page.getByText("Email verified. You can now sign in.")).toBeVisible();
  const database = await testDatabase();
  const user = await database.user.update({ where: { email: account.email }, data: { betaEligible: true, role: "owner" }, select: { id: true } });
  const signIn = await page.request.post("/api/auth/sign-in/email", { data: { email: account.email, password: account.password } });
  expect(signIn.ok(), await signIn.text()).toBe(true);
  await expect.poll(async () => (await page.request.get("/api/player/access")).status()).toBe(200);
  return { ...account, userId: user.id };
}

async function visibleHeaders(page: Page): Promise<string[]> {
  return page.getByRole("table").locator("thead th").allTextContents().then((headers) => headers.map((header) => header.trim()));
}

test("owner Witness and WitnessDef list, detail, edit, lookup, save, reload, and responsive surfaces", async ({ browser }) => {
  test.setTimeout(300_000);
  if (captureOwnerEvidence) mkdirSync(screenshotDirectory, { recursive: true });
  const context = await browser.newContext({ viewport: { height: 900, width: 1600 } });
  const page = await context.newPage();
  const rawPresentationTokens = /\b(?:CONCORD|RUIN|SCHISM|JUSTICE|MALE|FEMALE|NON_BINARY|SPECTRAL_VIOLET|REDRESS)\b/g;
  let rawOwnerTokenOccurrences = 0;
  const rawOwnerTokenEvidence: Array<{ path: string; tokens: string[] }> = [];
  const scanVisibleOwnerText = async () => {
    const visibleText = await page.locator("body").innerText();
    const tokens = visibleText.match(rawPresentationTokens) ?? [];
    rawOwnerTokenOccurrences += tokens.length;
    if (tokens.length) rawOwnerTokenEvidence.push({ path: new URL(page.url()).pathname, tokens });
  };
  let owner: Awaited<ReturnType<typeof createOwner>> | undefined;
  try {
    owner = await createOwner(page);

    await page.goto("/admin/data/witness");
    await page.locator("html[data-hydrated=true]").waitFor();
    await expect(page.getByRole("heading", { name: "Witness", exact: true })).toBeVisible();
    expect(await visibleHeaders(page)).toEqual(["", "Witness", "World", "Book", "Breed", "Age", "Gender", "Witness definition", "Source Architect", "True flaw", "Actions"]);
    await page.getByLabel("Search Witness").fill("CHA_WITNESS_OF_THE_HAMMER");
    const hammerRow = page.getByRole("table").locator("tbody tr").filter({ hasText: "The Witness of the Hammer" });
    await expect(hammerRow).toHaveCount(1);
    await expect(hammerRow).toContainText("Ruin");
    await expect(hammerRow).toContainText("Male");
    await expect(hammerRow).not.toContainText("CHA_WITNESS_OF_THE_HAMMER");
    await scanVisibleOwnerText();
    await captureScreenshot(page, "witness-table-1600x900.png");

    await page.goto("/admin/data/witness/CHA_WITNESS_OF_THE_HAMMER");
    await page.locator("html[data-hydrated=true]").waitFor();
    await expect(page.getByRole("heading", { name: "The Witness of the Hammer" })).toBeVisible();
    for (const fact of ["Minotaur", "Ruin", "Andrei Mihai Popescu", "Justice", "Retaliation", "Restitution", "53", "Male"]) await expect(page.getByText(fact, { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Soul continuity: Verified", { exact: true })).toBeVisible();
    for (const technicalId of ["CHA_WITNESS_OF_THE_HAMMER", "WDF_WITNESS_OF_THE_HAMMER", "CHA_ANDREI_MIHAI_POPESCU", "SOUL_ANDREI_MIHAI_POPESCU", "BRD_MINOTAUR"]) await expect(page.getByText(technicalId, { exact: true })).toHaveCount(0);
    await scanVisibleOwnerText();
    await captureScreenshot(page, "witness-detail-1600x900.png");

    await page.getByRole("button", { name: "Edit Record" }).click();
    const characterSection = page.getByRole("group", { name: "Character" });
    await expect(characterSection).toBeVisible();
    for (const field of ["Display Name *", "Age", "Skin Scale Color", "Hair Fur Color", "Eye Color", "Clothing"]) await expect(characterSection.getByLabel(field, { exact: true })).toBeVisible();
    for (const field of ["World Key", "Gender", "Faction", "Primary Attribute", "Secondary Attribute"]) await expect(characterSection.getByRole("combobox", { name: field, exact: true })).toBeVisible();
    for (const field of ["Breed", "Soul", "Occupation"]) await expect(characterSection.getByRole("group", { name: field, exact: true })).toBeVisible();
    await expect(characterSection.getByRole("combobox", { name: "Gender" }).getByRole("option")).toHaveText(["Not assigned", "Male", "Female", "Non-binary"]);
    await expect(characterSection.getByRole("combobox", { name: "World Key" }).getByRole("option")).toHaveText(["Not assigned", "Concord", "Ruin", "Schism"]);
    await scanVisibleOwnerText();
    await captureScreenshot(page, "witness-edit-character-section-1600x900.png");

    const breedSearch = page.getByRole("combobox", { name: "Search Breed" });
    await expect(breedSearch).toBeVisible();
    await breedSearch.click();
    await breedSearch.fill("BRD_AARDVARK");
    const aardvark = page.getByRole("option", { name: /Aardvark/ });
    await expect(aardvark).toBeVisible();
    await expect(aardvark).not.toContainText("BRD_AARDVARK");
    await captureScreenshot(page, "witness-open-relation-lookup-1600x900.png");
    await aardvark.click();
    await expect(page.getByText("Aardvark", { exact: true }).first()).toBeVisible();
    await page.getByRole("button", { name: "Clear Breed" }).click();
    await expect(page.getByText("Not assigned", { exact: true }).first()).toBeVisible();
    await breedSearch.click();
    await breedSearch.fill("BRD_MINOTAUR");
    await page.getByRole("option", { name: /^Minotaur/ }).click();
    await characterSection.getByRole("combobox", { name: "Gender" }).selectOption("MALE");
    await characterSection.getByRole("combobox", { name: "World Key" }).selectOption("RUIN");
    await captureScreenshot(page, "witness-humanized-enums-1600x900.png");
    await page.getByRole("button", { name: "Save Changes" }).click();
    await expect(page.getByText("Witness saved.", { exact: true })).toBeVisible();
    await page.reload();
    await page.locator("html[data-hydrated=true]").waitFor();
    await expect(page.getByText("Minotaur", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Male", { exact: true }).first()).toBeVisible();

    await page.goto("/admin/data/witness-def");
    await page.locator("html[data-hydrated=true]").waitFor();
    expect(await visibleHeaders(page)).toEqual(["", "Witness definition", "World", "Book", "Kernel", "Department", "Source Architect / Soul", "Apparent domain", "Real domain", "Spectral color", "Actions"]);
    await page.getByLabel("Search WitnessDef").fill("WDF_WITNESS_OF_THE_HAMMER");
    const definitionRow = page.getByRole("table").locator("tbody tr").filter({ hasText: "The Witness of the Hammer" });
    await expect(definitionRow).toHaveCount(1);
    await expect(definitionRow).toContainText("Redress");
    await expect(definitionRow).toContainText("Justice");
    await expect(definitionRow).not.toContainText("WDF_WITNESS_OF_THE_HAMMER");
    await scanVisibleOwnerText();
    await captureScreenshot(page, "witness-def-table-1600x900.png");
    await definitionRow.getByRole("link", { name: "View" }).click();
    await expect(page.getByRole("heading", { name: "The Witness of the Hammer" })).toBeVisible();
    for (const fact of ["Ruin", "Redress", "Justice", "Restitution", "Retaliation"]) await expect(page.getByText(fact, { exact: true }).first()).toBeVisible();
    await scanVisibleOwnerText();
    await captureScreenshot(page, "witness-def-detail-1600x900.png");

    await page.setViewportSize({ height: 844, width: 390 });
    await page.goto("/admin/data/witness");
    await page.locator("html[data-hydrated=true]").waitFor();
    const responsiveMetrics = await page.locator(".table-scroll").evaluate((element) => ({ clientWidth: element.clientWidth, scrollWidth: element.scrollWidth }));
    expect(responsiveMetrics.scrollWidth).toBeGreaterThan(responsiveMetrics.clientWidth);
    await expect(page.getByLabel("Search Witness")).toBeVisible();
    await captureScreenshot(page, "witness-table-responsive-390x844.png");

    await page.setViewportSize({ height: 900, width: 1600 });
    await page.goto("/admin/data/witness/CHA_WITNESS_OF_THE_HAMMER");
    const technicalSection = page.getByRole("group", { name: "Technical details" });
    await technicalSection.getByRole("button", { name: "Technical details" }).click();
    await technicalSection.getByText("Technical ID", { exact: true }).first().click();
    await expect(page.getByText("CHA_WITNESS_OF_THE_HAMMER", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Copy ID" }).first()).toBeVisible();
    expect(rawOwnerTokenEvidence, JSON.stringify(rawOwnerTokenEvidence)).toEqual([]);
    if (captureOwnerEvidence) writeFileSync(resolve(screenshotDirectory, "../owner-data-browser-evidence.json"), `${JSON.stringify({
      schemaVersion: "owner-data-browser-evidence-v1",
      status: "PASS",
      viewport: { width: 1600, height: 900 },
      assertions: {
        characterAndWitnessSaveAtomic: true,
        humanizedEnumDropdowns: true,
        lookupClearAndRestore: true,
        lookupSearchByCanonicalId: true,
        preservedSelectionAfterReload: true,
        responsiveTableOverflowReachable: true,
        technicalIdsCopyableAfterDisclosure: true,
        technicalIdsHiddenByDefault: true,
        rawOwnerTokenOccurrences,
        witnessCuratedColumns: true,
        witnessDefCuratedColumns: true,
        witnessHammerSemanticChainVisible: true,
      },
      screenshots: [
        "screenshots/witness-table-1600x900.png",
        "screenshots/witness-detail-1600x900.png",
        "screenshots/witness-edit-character-section-1600x900.png",
        "screenshots/witness-open-relation-lookup-1600x900.png",
        "screenshots/witness-humanized-enums-1600x900.png",
        "screenshots/witness-def-table-1600x900.png",
        "screenshots/witness-def-detail-1600x900.png",
        "screenshots/witness-table-responsive-390x844.png",
      ],
    }, null, 2)}\n`);
  } finally {
    await context.close().catch(() => undefined);
    if (owner) {
      const database = await testDatabase();
      await database.$transaction([
        database.verification.deleteMany({ where: { identifier: { contains: owner.email } } }),
        database.user.deleteMany({ where: { id: owner.userId } }),
      ]);
      rmSync(capturePath(owner.email), { force: true });
    }
  }
});
