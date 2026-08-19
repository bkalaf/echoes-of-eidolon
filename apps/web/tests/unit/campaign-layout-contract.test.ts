import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const webRoot = resolve(import.meta.dirname, "../..");
const screenSource = readFileSync(resolve(webRoot, "src/screens/admin/CampaignAdminPage.tsx"), "utf8");
const styles = readFileSync(resolve(webRoot, "src/styles.css"), "utf8");

describe("Campaign Planner viewport and density contract", () => {
  it("contains horizontal movement in a dedicated board viewport", () => {
    expect(screenSource).toContain('className="campaign-board-viewport"');
    expect(styles).toMatch(/\.campaign-planner-card\s*\{[^}]*min-width:\s*0[^}]*overflow:\s*hidden/s);
    expect(styles).toMatch(/\.campaign-board-viewport\s*\{[^}]*max-width:\s*100%[^}]*overflow-x:\s*auto/s);
  });

  it("uses explicit readable widths for record-heavy columns", () => {
    expect(screenSource).toContain("plannerColumnWidth");
    for (const column of ["COMPANION", "WITNESS", "ARCHITECT", "LEGENDARY_REWARD", "INTERLUDES"]) {
      expect(screenSource).toMatch(new RegExp(`${column}.+2[01]0`, "s"));
    }
  });

  it("keeps unassigned rows and movement controls readable without tiny text", () => {
    expect(styles).toMatch(/\.campaign-unassigned button\s*\{[^}]*min-height:\s*3[4-9]px[^}]*font-size:\s*1[2-9]px/s);
    expect(styles).toMatch(/\.campaign-move-button\s*\{[^}]*font-size:\s*1[1-9]px/s);
  });
});
