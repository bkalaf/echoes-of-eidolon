import { describe, expect, it } from "vitest";

import { assertResearchEvidence, resolveVisibleKnowledge } from "../../src/domain/knowledge-evidence";

const sources = [
  { authors: ["Author One"], sourceId: "SOURCE-1", title: "First Source" },
  { authors: ["Author Two"], sourceId: "SOURCE-2", title: "Second Source" },
];
const citations = [
  { citationId: "CIT-1", rendering: "First citation", sourceId: "SOURCE-1" },
  { citationId: "CIT-2", rendering: "Second citation", sourceId: "SOURCE-2" },
  { citationId: "CIT-HIDDEN", rendering: "Hidden citation", sourceId: "SOURCE-2" },
];

describe("knowledge evidence projection", () => {
  it("renders visible content first and deduplicates footnotes in first-use order", () => {
    const projection = resolveVisibleKnowledge([
      { citationIds: ["CIT-2", "CIT-1"], content: "Visible base", visible: true },
      { citationIds: ["CIT-1"], content: "Visible disclosure", visible: true },
    ], citations, sources);
    expect(projection.content).toEqual(["Visible base", "Visible disclosure"]);
    expect(projection.footnotes.map((entry) => entry.citation.citationId)).toEqual(["CIT-2", "CIT-1"]);
  });

  it("never leaks content or citations from hidden disclosures", () => {
    const projection = resolveVisibleKnowledge([
      { citationIds: ["CIT-1"], content: "Visible", visible: true },
      { citationIds: ["CIT-HIDDEN"], content: "Secret", visible: false },
    ], citations, sources);
    expect(projection.content).toEqual(["Visible"]);
    expect(projection.footnotes.map((entry) => entry.citation.citationId)).toEqual(["CIT-1"]);
    expect(JSON.stringify(projection)).not.toMatch(/Secret|CIT-HIDDEN|Hidden citation/);
  });

  it("fails closed when Citation to Source evidence is incomplete", () => {
    expect(() => assertResearchEvidence({ citationId: "CIT-MISSING" }, citations, sources)).toThrow("Visible Citation CIT-MISSING is missing");
    expect(() => assertResearchEvidence({ citationId: "CIT-1" }, citations, [])).toThrow("no legitimate Source evidence");
  });
});
