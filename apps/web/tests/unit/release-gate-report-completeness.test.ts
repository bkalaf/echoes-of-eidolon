import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const gatesRoot = resolve(process.cwd(), "../../artifacts/release-0.3.0/gates");

describe("release 0.3.0 gate report set", () => {
  it("contains one truthful package-schema report for every G00-G12 gate", async () => {
    const expectedNames = Array.from({ length: 13 }, (_, index) => `G${String(index).padStart(2, "0")}.json`);
    expect((await readdir(gatesRoot)).filter((name) => /^G\d{2}\.json$/.test(name)).sort()).toEqual(expectedNames);
    for (const name of expectedNames) {
      const report = JSON.parse(await readFile(resolve(gatesRoot, name), "utf8")) as Record<string, unknown>;
      expect(report.schemaVersion, name).toBe("echoes-release-gate-report-v1");
      expect(report.gateId, name).toBe(name.slice(0, 3));
      expect(["PASS", "FAIL", "BLOCKED", "NOT_RUN"], name).toContain(report.status);
      expect(report.release, name).toBe("0.3.0");
      expect(report.commitSha, name).toMatch(/^(?:[0-9a-f]{40}|NOT_APPLICABLE)$/);
      expect(typeof report.environment, name).toBe("string");
      expect(Array.isArray(report.dependencies), name).toBe(true);
      expect(Array.isArray(report.commands), name).toBe(true);
      expect(Array.isArray(report.assertions), name).toBe(true);
      expect(Array.isArray(report.artifacts), name).toBe(true);
      expect(Array.isArray(report.blockers), name).toBe(true);
    }
  });
});
