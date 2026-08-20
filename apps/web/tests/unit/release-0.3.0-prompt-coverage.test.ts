import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const repositoryRoot = resolve(import.meta.dirname, "../../../..");
const traceability = JSON.parse(
  readFileSync(resolve(repositoryRoot, "artifacts/release-0.3.0/traceability.json"), "utf8"),
) as {
  workItems: Array<{ id: string; prompt: string; status: string }>;
};
const executionState = JSON.parse(
  readFileSync(resolve(repositoryRoot, "artifacts/release-0.3.0/execution-state.json"), "utf8"),
) as {
  tasks: Array<{ id: string; promptIds?: string[] }>;
};

const expectedPromptIds = [
  "R030-Q01",
  "R030-Q02",
  "R030-Q03",
  "R030-Q04",
  "R030-Q05",
  "R030-Q06",
  "R030-Q07",
  "R030-Q08",
  "R030-Q09",
  "R030-Q10",
  "R030-Q11",
  "R030-Q12",
  "R030-Q13",
  "R030-Q14U",
  "R030-Q15",
  "R030-Q16A",
  "R030-Q16B",
  "R030-Q17",
] as const;

describe("Release 0.3.0 prompt coverage", () => {
  it("tracks all 18 append-only queue entries in source order", () => {
    expect(traceability.workItems.map(({ id }) => id)).toEqual(expectedPromptIds);
  });

  it("preserves the unnumbered item and both source Prompt 16 entries", () => {
    expect(traceability.workItems.map(({ id }) => id)).toEqual(
      expect.arrayContaining(["R030-Q14U", "R030-Q16A", "R030-Q16B"]),
    );
  });

  it("links every work item to its verbatim package prompt", () => {
    for (const workItem of traceability.workItems) {
      expect(workItem.prompt).toBe(
        `ECHOES_OF_EIDOLON_0_3_0_CODEX_EXECUTION_PACKAGE_2026-08-18/prompts/${workItem.id}.md`,
      );
    }
  });

  it("maps T010 to every queue entry without duplicates", () => {
    const task = executionState.tasks.find(({ id }) => id === "T010");
    expect(task?.promptIds).toEqual(expectedPromptIds);
    expect(new Set(task?.promptIds).size).toBe(expectedPromptIds.length);
  });
});
