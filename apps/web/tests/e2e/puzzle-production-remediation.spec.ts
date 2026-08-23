import { createHash } from "node:crypto";
import { readFileSync, rmSync } from "node:fs";
import { resolve } from "node:path";

import { expect, test, type Locator, type Page } from "@playwright/test";

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
  await expect.poll(() => {
    try {
      const record = JSON.parse(readFileSync(capturePath(account.email), "utf8")) as { code?: string };
      code = record.code ?? "";
      return /^\d{6}$/.test(code);
    } catch {
      return false;
    }
  }).toBe(true);
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
  return { ...account, userId: user.id };
}

async function selectPuzzle(page: Page, puzzleBlueprintId: string) {
  await page.getByLabel("Puzzle Blueprint").selectOption(puzzleBlueprintId);
  await expect(page.getByRole("heading", { name: new RegExp(`^${puzzleBlueprintId} ·`) })).toBeVisible();
  return page.getByRole("article", { name: /player puzzle$/ });
}

function matrixCell(surface: Locator, matrix: "A" | "B", row: number, column: number) {
  return surface.getByRole("button", { name: new RegExp(`^Matrix ${matrix}, row ${row}, column ${column}, value -?\\d+$`) });
}

async function solveCancellation(surface: Locator) {
  const labels = await surface.locator(".puzzle-matrix__cell").evaluateAll((buttons) => buttons.map((button) => button.getAttribute("aria-label")!));
  const values = new Map(labels.map((label) => {
    const match = label.match(/^Matrix ([AB]), row (\d+), column (\d+), value (-?\d+)$/)!;
    return [`${match[1]}:${match[2]}:${match[3]}`, Number(match[4])] as const;
  }));
  let solution: { column: number; row: number } | undefined;
  for (let row = 1; row <= 6 && !solution; row += 1) {
    for (let column = 1; column <= 6; column += 1) {
      if (values.get(`A:${row}:${column}`)! + values.get(`B:${row}:${column}`)! === 0) solution = { column, row };
    }
  }
  expect(solution).toBeDefined();
  const wrong = solution!.column === 1 && solution!.row === 1 ? { column: 2, row: 1 } : { column: 1, row: 1 };
  await matrixCell(surface, "A", wrong.row, wrong.column).click();
  await surface.getByRole("button", { name: "Check coordinate" }).click();
  await expect(surface.locator("p[role=status]")).toContainText("does not cancel");
  await matrixCell(surface, "A", solution!.row, solution!.column).press("Enter");
  await surface.getByRole("button", { name: "Check coordinate" }).press("Enter");
  await expect(surface.locator("p[role=status]")).toContainText("Coordinate accepted");
}

function union(left: number[], right: number[]) {
  return [...new Set([...left, ...right])].sort((a, b) => a - b);
}

function intersect(left: number[], right: number[]) {
  const rightSet = new Set(right);
  return left.filter((value) => rightSet.has(value)).sort((a, b) => a - b);
}

async function solveSetAmbigram(surface: Locator) {
  const entries = await surface.locator(".puzzle-set-card").evaluateAll((cards) => cards.map((card) => ({
    members: [...card.querySelectorAll(".puzzle-token")].map((token) => Number(token.textContent)),
    name: card.querySelector("h3")!.textContent!.replace("Set ", ""),
  })));
  const sets = Object.fromEntries(entries.map((entry) => [entry.name, entry.members])) as Record<"A" | "B" | "C", number[]>;
  const seal = await surface.getByRole("complementary", { name: "Wax-seal result clue" }).innerText();
  const expected = {
    count: Number(seal.match(/(\d+) members/)![1]),
    product: Number(seal.match(/member product (\d+)/)![1]),
    total: Number(seal.match(/member total (\d+)/)![1]),
  };
  const candidates = [
    intersect(union(sets.A, sets.B), sets.C),
    union(sets.A, intersect(sets.B, sets.C)),
    union(intersect(sets.A, sets.B), sets.C),
    intersect(sets.A, union(sets.B, sets.C)),
  ];
  const solution = candidates.find((candidate) => candidate.length === expected.count
    && candidate.reduce((sum, value) => sum + value, 0) === expected.total
    && candidate.reduce((product, value) => product * value, 1) === expected.product);
  expect(solution).toBeDefined();
  const universe = [...new Set(Object.values(sets).flat())].sort((a, b) => a - b);
  const wrong = solution!.length > 1 ? solution!.slice(1) : [universe.find((member) => member !== solution![0])!];
  for (const member of wrong) await surface.getByRole("button", { name: `Select member ${member}` }).click();
  await surface.getByRole("button", { name: "Check selected set" }).click();
  await expect(surface.locator("p[role=status]")).toContainText("does not match");
  for (const member of wrong) await surface.getByRole("button", { name: `Remove member ${member}` }).click();
  for (const member of solution!) await surface.getByRole("button", { name: `Select member ${member}` }).press("Enter");
  await surface.getByRole("button", { name: "Check selected set" }).press("Enter");
  await expect(surface.locator("p[role=status]")).toContainText("Set accepted");
}

async function solveMusicalHex(surface: Locator) {
  await surface.getByRole("button", { name: "Play melody" }).press("Enter");
  await expect(surface.getByRole("button", { name: "Replay melody" })).toBeVisible();
  await surface.getByRole("button", { name: "Stop" }).click();
  await surface.getByRole("button", { name: "Accessible equivalent" }).click();
  const groups = await surface.getByRole("table", { name: "Texture-grid equivalent" }).locator("td").allTextContents();
  const counts = new Map<string, number>();
  for (const group of groups) counts.set(group, (counts.get(group) ?? 0) + 1);
  const solution = [...counts].find(([, count]) => count > 1)?.[0];
  expect(solution).toMatch(/^[A-F]{6}$/);
  const wrong = `${solution![0] === "A" ? "B" : "A"}${solution!.slice(1)}`;
  const input = surface.getByLabel("Six hexadecimal characters");
  await input.fill(wrong);
  await surface.getByRole("button", { name: "Check hexadecimal group" }).press("Enter");
  await expect(surface.locator("p[role=status]")).toContainText("not the repeated");
  await input.fill(solution!.toLowerCase());
  await surface.getByRole("button", { name: "Check hexadecimal group" }).click();
  await expect(surface.locator("p[role=status]")).toContainText("Hexadecimal group accepted");
}

async function solveThresholdRoute(surface: Locator) {
  await surface.getByRole("button", { name: "Accessible equivalent" }).click();
  const values = (await surface.getByRole("table", { name: "Source luminance values" }).locator("td").allTextContents()).map(Number).sort((a, b) => a - b);
  let split = 0;
  for (let index = 1; index < values.length; index += 1) if (values[index]! - values[index - 1]! > values[split]! - values[Math.max(0, split - 1)]!) split = index;
  const threshold = Math.floor((values[split - 1]! + values[split]!) / 2);
  const slider = surface.getByLabel("Threshold level");
  await slider.fill("1");
  await surface.getByRole("button", { name: "Continue through recovered mark" }).press("Enter");
  await expect(surface.locator("p[role=status]")).toContainText("not recovered");
  await slider.fill(String(threshold));
  await surface.getByRole("button", { name: "Continue through recovered mark" }).click();
  const cards = surface.getByRole("list", { name: "Symbol cards" });
  await expect(cards.locator("li")).toHaveCount(10);
  for (let pass = 0; pass < 10; pass += 1) {
    const items = cards.locator("li");
    for (let index = 0; index < 9 - pass; index += 1) {
      const left = (await items.nth(index).locator(".puzzle-card-notches").innerText()).length;
      const right = (await items.nth(index + 1).locator(".puzzle-card-notches").innerText()).length;
      if (left > right) await items.nth(index).getByRole("button", { name: / right$/ }).click();
    }
  }
  await cards.locator("li").first().getByRole("button", { name: / right$/ }).click();
  await surface.getByRole("button", { name: "Check ordered symbols" }).press("Enter");
  await expect(surface.locator("p[role=status]")).toContainText("does not complete");
  await cards.locator("li").nth(1).getByRole("button", { name: / left$/ }).click();
  await surface.getByRole("button", { name: "Check ordered symbols" }).click();
  await expect(surface.locator("p[role=status]")).toContainText("Ordered symbols accepted");
}

test("owner plays all four production puzzles through canonical surfaces and live validation", async ({ browser }) => {
  test.setTimeout(240_000);
  const context = await browser.newContext();
  const page = await context.newPage();
  let principal: Awaited<ReturnType<typeof createOwner>> | undefined;
  try {
    const unauthorizedReveal = await page.request.post("/api/admin/puzzles/solution", { data: { generation: 0, puzzleBlueprintId: "PZB-011" } });
    expect([401, 403]).toContain(unauthorizedReveal.status());
    principal = await createOwner(page);
    const payload = await (await page.request.get("/api/admin/puzzles/preview")).text();
    expect(payload).not.toMatch(/"(?:canonicalSolution|expectedSolution|proofDigest|instanceChecksum|encodedValue|decodeOffset|moduleMatrixTable)"\s*:/i);

    for (const [puzzleBlueprintId, solve] of [
      ["PZB-011", solveCancellation],
      ["PZB-012", solveSetAmbigram],
      ["PZB-021", solveThresholdRoute],
      ["PZB-037", solveMusicalHex],
    ] as const) {
      const surface = await selectPuzzle(page, puzzleBlueprintId);
      await surface.getByRole("button", { name: "Hint 1" }).click();
      await expect(surface.getByRole("region", { name: "Puzzle hints" }).locator("p").filter({ hasText: "Hint 1" })).toBeVisible();
      await surface.getByRole("button", { name: "Hint 2" }).click();
      await expect(surface.getByRole("region", { name: "Puzzle hints" }).locator("p").filter({ hasText: "Hint 2" })).toBeVisible();
      await solve(surface);
      await expect(page.getByRole("heading", { name: "Validation history" }).locator("..")).toContainText("Correct");
      if (puzzleBlueprintId === "PZB-011") {
        await page.emulateMedia({ media: "print" });
        await expect(page.getByLabel("Owner puzzle QA panel")).toBeHidden();
        await expect(surface.getByRole("table", { name: "Matrix A" })).toBeVisible();
        await expect(surface.getByRole("table", { name: "Matrix B" })).toBeVisible();
        await page.emulateMedia({ media: "screen" });
      }
      if (puzzleBlueprintId === "PZB-012") {
        await page.emulateMedia({ media: "print" });
        await expect(page.getByLabel("Owner puzzle QA panel")).toBeHidden();
        await expect(surface.locator(".puzzle-set-cards")).toBeVisible();
        await expect(surface.getByRole("group", { name: "Possible scoped readings" })).toBeVisible();
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
      await database.$transaction([
        database.verification.deleteMany({ where: { identifier: { contains: principal.email } } }),
        database.user.deleteMany({ where: { id: principal.userId } }),
      ]);
      rmSync(capturePath(principal.email), { force: true });
    }
  }
});
