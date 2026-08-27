import { expect, type Locator } from "@playwright/test";

const cancellationGlyphs: Record<string, string> = {
  "0110/1001/1111/1001/1001": "A", "1110/1001/1110/1001/1110": "B", "0111/1000/1000/1000/0111": "C", "1110/1001/1001/1001/1110": "D",
  "1111/1000/1110/1000/1111": "E", "1111/1000/1110/1000/1000": "F", "0111/1000/1011/1001/0111": "G", "1001/1001/1111/1001/1001": "H",
  "1110/0001/0110/1000/1111": "2", "1110/0001/0110/0001/1110": "3", "1001/1001/1111/0001/0001": "4", "1111/1000/1110/0001/1110": "5",
  "0111/1000/1110/1001/0110": "6", "1111/0001/0010/0100/0100": "7", "0110/1001/0110/1001/0110": "8", "0110/1001/0111/0001/1110": "9",
};
const musicGlyphs: Record<string, string> = {
  "0110/1001/1111/1001": "A", "1110/1001/1110/1110": "B", "1111/1000/1000/1111": "C",
  "1110/1001/1001/1110": "D", "1111/1000/1110/1111": "E", "1111/1000/1110/1000": "F",
};

function union(left: number[], right: number[]) { return [...new Set([...left, ...right])].sort((a, b) => a - b); }
function intersect(left: number[], right: number[]) { const rightSet = new Set(right); return left.filter((value) => rightSet.has(value)).sort((a, b) => a - b); }

export async function solveQuietAccord(surface: Locator) {
  const values = await surface.locator(".puzzle-matrix__cell").evaluateAll((buttons) => buttons.map((button) => {
    const match = button.getAttribute("aria-label")!.match(/^Record ([AB]), row (\d+), column (\d+), value (-?\d+)$/)!;
    return { column: Number(match[3]), record: match[1], row: Number(match[2]), value: Number(match[4]) };
  }));
  const byCoordinate = new Map(values.map((entry) => [`${entry.record}:${entry.row}:${entry.column}`, entry.value]));
  const markedCoordinates: Array<{ column: number; row: number }> = [];
  for (let row = 1; row <= 7; row += 1) for (let column = 1; column <= 31; column += 1) if (byCoordinate.get(`A:${row}:${column}`)! + byCoordinate.get(`B:${row}:${column}`)! === 0) markedCoordinates.push({ column, row });
  const solution = Array.from({ length: 6 }, (_, glyphIndex) => {
    const startColumn = 2 + glyphIndex * 5;
    const pattern = Array.from({ length: 5 }, (_, row) => Array.from({ length: 4 }, (_, column) => markedCoordinates.some((coordinate) => coordinate.row === row + 2 && coordinate.column === startColumn + column) ? "1" : "0").join("")).join("/");
    return cancellationGlyphs[pattern];
  }).join("");
  expect(solution).toMatch(/^[A-H2-9]{6}$/);
  const recordA = surface.locator('table[aria-label="Record A"] tbody button');
  const first = markedCoordinates[0]!;
  await recordA.nth((first.row - 1) * 31 + first.column - 1).click();
  const input = surface.getByLabel("Six-character bitmap reading");
  const wrong = `${solution[0] === "A" ? "B" : "A"}${solution.slice(1)}`;
  await input.fill(wrong);
  await surface.getByRole("button", { name: "Check the accord" }).click();
  await expect(surface.locator("p[role=status]")).toContainText("do not yet preserve");
  const remainingIndices = markedCoordinates.slice(1, -1).map((coordinate) => (coordinate.row - 1) * 31 + coordinate.column - 1);
  await recordA.evaluateAll((buttons, indices) => { for (const index of indices) (buttons[index] as HTMLButtonElement).click(); }, remainingIndices);
  const last = markedCoordinates.at(-1)!;
  await recordA.nth((last.row - 1) * 31 + last.column - 1).press("Enter");
  await input.fill(solution);
  await surface.getByRole("button", { name: "Check the accord" }).press("Enter");
  await expect(surface.locator("p[role=status]")).toContainText("accord is complete");
}

export async function solveThirdReading(surface: Locator) {
  const entries = await surface.locator(".puzzle-set-card").evaluateAll((cards) => cards.map((card) => ({
    members: [...card.querySelectorAll(".puzzle-token")].map((token) => Number(token.textContent)),
    name: card.querySelector("h3")!.textContent!.replace("Card ", ""),
  })));
  const sets = Object.fromEntries(entries.map((entry) => [entry.name, entry.members])) as Record<"A" | "B" | "C", number[]>;
  const seal = await surface.getByRole("complementary", { name: "Wax-seal result clue" }).innerText();
  const expected = { count: Number(seal.match(/(\d+) members/)![1]), product: Number(seal.match(/product (\d+)/)![1]), total: Number(seal.match(/total (\d+)/)![1]) };
  const candidates = [intersect(union(sets.A, sets.B), sets.C), union(sets.A, intersect(sets.B, sets.C)), union(intersect(sets.A, sets.B), sets.C), intersect(sets.A, union(sets.B, sets.C))];
  const solution = candidates.find((candidate) => candidate.length === expected.count && candidate.reduce((sum, value) => sum + value, 0) === expected.total && candidate.reduce((product, value) => product * value, 1) === expected.product)!;
  const universe = [...new Set(Object.values(sets).flat())].sort((a, b) => a - b);
  const wrong = solution.length > 1 ? solution.slice(1) : [universe.find((member) => member !== solution[0])!];
  for (const member of wrong) await surface.getByRole("button", { name: `Select member ${member}` }).click();
  await surface.getByRole("button", { name: "Check selected set" }).click();
  await expect(surface.locator("p[role=status]")).toContainText("does not match");
  for (const member of wrong) await surface.getByRole("button", { name: `Remove member ${member}` }).click();
  for (const member of solution) await surface.getByRole("button", { name: `Select member ${member}` }).press("Enter");
  await surface.getByRole("button", { name: "Check selected set" }).press("Enter");
  await expect(surface.locator("p[role=status]")).toContainText("Set accepted");
}

export async function solveThePall(surface: Locator) {
  await surface.getByRole("button", { name: "Accessible equivalent" }).click();
  const values = (await surface.getByRole("table", { name: "Source tone table" }).locator("td").allTextContents()).map(Number).sort((a, b) => a - b);
  let split = 1;
  for (let index = 2; index < values.length; index += 1) if (values[index]! - values[index - 1]! > values[split]! - values[split - 1]!) split = index;
  const threshold = Math.floor((values[split - 1]! + values[split]!) / 2);
  const slider = surface.getByLabel("Light-dark separation");
  await slider.fill("1");
  await surface.getByRole("button", { name: "Enter the recovered passage" }).press("Enter");
  await expect(surface.locator("p[role=status]")).toContainText("not recovered");
  await slider.fill(String(threshold));
  await surface.getByRole("button", { name: "Enter the recovered passage" }).click();
  const cards = surface.getByRole("list", { name: "Symbol cards" });
  await expect(cards.locator("li")).toHaveCount(10);
  for (let pass = 0; pass < 10; pass += 1) for (let index = 0; index < 9 - pass; index += 1) {
    const items = cards.locator("li");
    const left = (await items.nth(index).locator(".puzzle-card-notches").innerText()).length;
    const right = (await items.nth(index + 1).locator(".puzzle-card-notches").innerText()).length;
    if (left > right) await items.nth(index).getByRole("button", { name: / right$/ }).click();
  }
  await cards.locator("li").first().getByRole("button", { name: / right$/ }).click();
  await surface.getByRole("button", { name: "Try this order" }).press("Enter");
  await expect(surface.locator("p[role=status]")).toContainText("does not complete");
  await cards.locator("li").nth(1).getByRole("button", { name: / left$/ }).click();
  await surface.getByRole("button", { name: "Try this order" }).click();
  await expect(surface.locator("p[role=status]")).toContainText("passage is complete");
}

export async function solveGlassVespers(surface: Locator) {
  await surface.getByRole("button", { name: "Play" }).press("Enter");
  await expect(surface.getByRole("button", { name: "Pause" })).toBeVisible();
  await surface.getByRole("button", { name: "Pause" }).click();
  await expect(surface.getByRole("button", { name: "Resume" })).toBeVisible();
  await surface.getByRole("button", { name: "Stop" }).click();
  await surface.getByLabel("Retained notes per pane").selectOption("5");
  await surface.getByLabel("Control separator").selectOption("G");
  await expect(surface.getByRole("img", { name: "Developed 32 by 4 glass pane" })).toHaveCount(0);
  await surface.getByLabel("Retained notes per pane").selectOption("6");
  await expect(surface.getByRole("img", { name: "Developed 32 by 4 glass pane" })).toBeVisible();
  await surface.getByRole("button", { name: "Note-event table" }).click();
  const rows = await surface.getByRole("table", { name: "Note-event table" }).locator("tbody tr").evaluateAll((entries) => entries.map((row) => [...row.querySelectorAll("td")].map((cell) => cell.textContent ?? "")));
  const cells = Array.from({ length: 128 }, (_, measure) => rows.filter((row) => Number(row[0]) === measure + 1 && row[3] === "score").map((row) => row[2]).join(""));
  expect(cells.every((cell) => /^[A-F]{6}$/.test(cell))).toBe(true);
  const widths = [6, 5, 5, 5, 5, 6];
  const dark = ["AADAAA", "AAAADD", "DDBBAA", "BBAADD", "DDAAAA", "AACCCC"];
  let offset = 0;
  const solution = widths.map((width, answerIndex) => {
    const glyphOffset = answerIndex === 0 ? 1 : 0;
    const pattern = Array.from({ length: 4 }, (_, row) => Array.from({ length: 4 }, (_, column) => cells[row * 32 + offset + glyphOffset + column] === dark[answerIndex] ? "1" : "0").join("")).join("/");
    offset += width;
    return musicGlyphs[pattern];
  }).join("");
  expect(solution).toMatch(/^[A-F]{6}$/);
  const input = surface.getByLabel("Six hexadecimal characters");
  await input.fill(`#${solution}`);
  await surface.getByRole("button", { name: "Read the glass" }).click();
  await expect(surface.locator("p[role=status]")).toContainText("does not appear");
  const wrong = `${solution[0] === "A" ? "B" : "A"}${solution.slice(1)}`;
  await input.fill(wrong);
  await surface.getByRole("button", { name: "Read the glass" }).click();
  await expect(surface.locator("p[role=status]")).toContainText("does not appear");
  await input.fill(solution.toLowerCase());
  await surface.getByRole("button", { name: "Read the glass" }).press("Enter");
  await expect(surface.locator("p[role=status]")).toContainText("glass holds");
  await surface.getByRole("button", { name: "Texture on/off grid" }).click();
  await expect(surface.getByRole("table", { name: "Texture on-off grid" })).toBeVisible();
}

export const memberPuzzleSolvers = Object.freeze({
  "quiet-accord": solveQuietAccord,
  "third-reading": solveThirdReading,
  "the-pall": solveThePall,
  "glass-vespers": solveGlassVespers,
});
