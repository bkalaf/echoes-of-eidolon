import { describe, expect, it } from "vitest";

import type { CapabilityStateEntry } from "../../src/domain/capabilities";
import { projectKnowledgeDisclosures, type KnowledgeBlock, type KnowledgeDisclosure } from "../../src/domain/knowledge-disclosures";

const base: KnowledgeBlock[] = [
  { knowledgeBaseBlockId: "B1", kind: "HEADING", content: "Base heading", citationIds: ["C1"] },
  { knowledgeBaseBlockId: "B2", kind: "PARAGRAPH", content: "Base paragraph", citationIds: ["C2"] },
];
const citations = [
  { citationId: "C1", rendering: "one", sourceId: "S1" },
  { citationId: "C2", rendering: "two", sourceId: "S2" },
  { citationId: "C3", rendering: "three", sourceId: "S3" },
  { citationId: "SECRET", rendering: "hidden", sourceId: "S3" },
];
const sources = [
  { sourceId: "S1", title: "One", authors: [] },
  { sourceId: "S2", title: "Two", authors: [] },
  { sourceId: "S3", title: "Three", authors: [] },
];

function state(value: CapabilityStateEntry["value"]): Map<string, CapabilityStateEntry> {
  return new Map([["DEF", { capabilityDefinitionId: "DEF", key: "authored", value }]]);
}

describe("knowledge disclosure projection", () => {
  it("applies append, insert, replace-block, and replace-entry in authored order", () => {
    const disclosures: KnowledgeDisclosure[] = [
      { knowledgeBaseDisclosureId: "D1", capabilityDefinitionId: "DEF", operator: "EXISTS", mode: "APPEND_BLOCKS", blocks: [{ knowledgeBaseBlockId: "B3", kind: "QUOTE", content: "Append", citationIds: ["C3"] }] },
      { knowledgeBaseDisclosureId: "D2", capabilityDefinitionId: "DEF", operator: "EQ", requiredValue: true, mode: "INSERT_AFTER_BLOCK", anchorBlockId: "B1", blocks: [{ knowledgeBaseBlockId: "B1A", kind: "LIST", content: "Insert", citationIds: [] }] },
      { knowledgeBaseDisclosureId: "D3", capabilityDefinitionId: "DEF", operator: "EQ", requiredValue: true, mode: "REPLACE_BLOCK", anchorBlockId: "B2", blocks: [{ knowledgeBaseBlockId: "B2R", kind: "PARAGRAPH", content: "Replace", citationIds: ["C1"] }] },
    ];
    const projection = projectKnowledgeDisclosures(base, disclosures, state(true), citations, sources);
    expect(projection.blocks.map((block) => block.knowledgeBaseBlockId)).toEqual(["B1", "B1A", "B2R", "B3"]);
    expect(projection.footnotes.map((footnote) => footnote.citation.citationId)).toEqual(["C1", "C3"]);

    const replaced = projectKnowledgeDisclosures(base, [{
      knowledgeBaseDisclosureId: "D4", capabilityDefinitionId: "DEF", operator: "EXISTS", mode: "REPLACE_ENTRY",
      blocks: [{ knowledgeBaseBlockId: "ONLY", kind: "PARAGRAPH", content: "Only", citationIds: ["C3"] }],
    }], state(true), citations, sources);
    expect(replaced.blocks.map((block) => block.knowledgeBaseBlockId)).toEqual(["ONLY"]);
    expect(replaced.footnotes.map((footnote) => footnote.citation.citationId)).toEqual(["C3"]);
  });

  it("does not leak content or citations from unmet disclosures", () => {
    const projection = projectKnowledgeDisclosures(base, [{
      knowledgeBaseDisclosureId: "SECRET-D", capabilityDefinitionId: "DEF", operator: "EQ", requiredValue: true,
      mode: "APPEND_BLOCKS", blocks: [{ knowledgeBaseBlockId: "SECRET-B", kind: "PARAGRAPH", content: "Secret", citationIds: ["SECRET"] }],
    }], state(false), citations, sources);
    expect(JSON.stringify(projection)).not.toMatch(/Secret|SECRET/);
    expect(projection.blocks).toEqual(base);
  });

  it("fails closed on missing anchors and invalid comparison types", () => {
    expect(() => projectKnowledgeDisclosures(base, [{
      knowledgeBaseDisclosureId: "D", capabilityDefinitionId: "DEF", operator: "EXISTS", mode: "REPLACE_BLOCK", blocks: [],
    }], state(true), citations, sources)).toThrow(/requires an authored anchor/);
    expect(() => projectKnowledgeDisclosures(base, [{
      knowledgeBaseDisclosureId: "D", capabilityDefinitionId: "DEF", operator: "GT", requiredValue: 1, mode: "APPEND_BLOCKS", blocks: [],
    }], state(true), citations, sources)).toThrow(/requires numeric/);
  });
});
