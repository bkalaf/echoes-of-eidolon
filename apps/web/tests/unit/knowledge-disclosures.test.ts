import { describe, expect, it } from "vitest";

import {
  capabilityStateKey,
  resolveCapability,
  type CapabilityDefinitionVersionContract,
  type CapabilityStateEntry,
} from "../../src/domain/capabilities";
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
const capability: CapabilityDefinitionVersionContract = {
  capabilityDefinitionId: "DEF",
  capabilityDefinitionVersionId: "DEF:V1",
  code: "AUTHORED",
  version: 1,
  pathPattern: "authored",
  parameters: [],
  valueKind: "BOOLEAN",
  allowedOperations: ["SET"],
  monotonicPolicy: "NONE",
};
const address = resolveCapability(capability, {});
const scope = { scopeType: "ACCOUNT" as const, scopeId: "ACCOUNT-1" };
const definitions = new Map([[capability.capabilityDefinitionVersionId, capability]]);

function state(value: boolean): Map<string, CapabilityStateEntry> {
  return new Map([[capabilityStateKey(scope, address), {
    scope,
    address,
    capabilityDefinitionVersionId: capability.capabilityDefinitionVersionId,
    isPresent: true,
    value,
    lastSequence: 1n,
  }]]);
}

function project(disclosures: KnowledgeDisclosure[], capabilityState = state(true)) {
  return projectKnowledgeDisclosures(base, disclosures, capabilityState, definitions, citations, sources);
}

describe("knowledge disclosure projection", () => {
  it("30 uses fully bound capability condition trees", () => {
    const disclosures: KnowledgeDisclosure[] = [
      {
        knowledgeBaseDisclosureId: "D1",
        condition: { all: [
          { scope, address, operator: "EXISTS" },
          { not: { scope, address, operator: "EQ", value: false } },
        ] },
        mode: "APPEND_BLOCKS",
        blocks: [{ knowledgeBaseBlockId: "B3", kind: "QUOTE", content: "Append", citationIds: ["C3"] }],
      },
      {
        knowledgeBaseDisclosureId: "D2",
        condition: { scope, address, operator: "EQ", value: true },
        mode: "INSERT_AFTER_BLOCK",
        anchorBlockId: "B1",
        blocks: [{ knowledgeBaseBlockId: "B1A", kind: "LIST", content: "Insert", citationIds: [] }],
      },
      {
        knowledgeBaseDisclosureId: "D3",
        condition: { scope, address, operator: "EQ", value: true },
        mode: "REPLACE_BLOCK",
        anchorBlockId: "B2",
        blocks: [{ knowledgeBaseBlockId: "B2R", kind: "PARAGRAPH", content: "Replace", citationIds: ["C1"] }],
      },
    ];
    const projection = project(disclosures);
    expect(projection.blocks.map((block) => block.knowledgeBaseBlockId)).toEqual(["B1", "B1A", "B2R", "B3"]);
    expect(projection.footnotes.map((footnote) => footnote.citation.citationId)).toEqual(["C1", "C3"]);
  });

  it("31 omits hidden knowledge and citations when conditions fail", () => {
    const projection = project([{
      knowledgeBaseDisclosureId: "SECRET-D",
      condition: { scope, address, operator: "EQ", value: true },
      mode: "APPEND_BLOCKS",
      blocks: [{ knowledgeBaseBlockId: "SECRET-B", kind: "PARAGRAPH", content: "Secret", citationIds: ["SECRET"] }],
    }], state(false));
    expect(JSON.stringify(projection)).not.toMatch(/Secret|SECRET/);
    expect(projection.blocks).toEqual(base);
  });

  it("preserves replace-entry behavior and fails closed on missing anchors", () => {
    const replaced = project([{
      knowledgeBaseDisclosureId: "D4",
      condition: { scope, address, operator: "EXISTS" },
      mode: "REPLACE_ENTRY",
      blocks: [{ knowledgeBaseBlockId: "ONLY", kind: "PARAGRAPH", content: "Only", citationIds: ["C3"] }],
    }]);
    expect(replaced.blocks.map((block) => block.knowledgeBaseBlockId)).toEqual(["ONLY"]);
    expect(() => project([{
      knowledgeBaseDisclosureId: "D5",
      condition: { scope, address, operator: "EXISTS" },
      mode: "REPLACE_BLOCK",
      blocks: [],
    }])).toThrow(/requires an authored anchor/);
  });
});
