import type { CapabilityStateEntry, CapabilityValue } from "./capabilities";
import { resolveVisibleKnowledge, type CitationEvidence, type SourceEvidence, type VisibleFootnote } from "./knowledge-evidence";

export type CapabilityRequirementOperator = "EXISTS" | "EQ" | "NEQ" | "GT" | "GTE" | "LT" | "LTE";
export type KnowledgeBaseBlockKind = "HEADING" | "PARAGRAPH" | "QUOTE" | "LIST";
export type KnowledgeBaseDisclosureMode = "APPEND_BLOCKS" | "INSERT_AFTER_BLOCK" | "REPLACE_BLOCK" | "REPLACE_ENTRY";

export interface KnowledgeBlock {
  knowledgeBaseBlockId: string;
  kind: KnowledgeBaseBlockKind;
  content: string;
  citationIds: string[];
}

export interface KnowledgeDisclosure {
  knowledgeBaseDisclosureId: string;
  capabilityDefinitionId: string;
  operator: CapabilityRequirementOperator;
  requiredValue?: CapabilityValue;
  mode: KnowledgeBaseDisclosureMode;
  anchorBlockId?: string | null;
  blocks: KnowledgeBlock[];
}

function requirementMet(disclosure: KnowledgeDisclosure, state: ReadonlyMap<string, CapabilityStateEntry>): boolean {
  const actual = state.get(disclosure.capabilityDefinitionId)?.value;
  if (disclosure.operator === "EXISTS") return actual !== undefined;
  if (disclosure.requiredValue === undefined) throw new Error(`${disclosure.operator} requires an authored comparison value.`);
  if (disclosure.operator === "EQ") return actual === disclosure.requiredValue;
  if (disclosure.operator === "NEQ") return actual !== undefined && actual !== disclosure.requiredValue;
  if (typeof actual !== "number" || typeof disclosure.requiredValue !== "number") {
    throw new Error(`${disclosure.operator} requires numeric capability values.`);
  }
  if (disclosure.operator === "GT") return actual > disclosure.requiredValue;
  if (disclosure.operator === "GTE") return actual >= disclosure.requiredValue;
  if (disclosure.operator === "LT") return actual < disclosure.requiredValue;
  return actual <= disclosure.requiredValue;
}

function applyDisclosure(blocks: KnowledgeBlock[], disclosure: KnowledgeDisclosure): KnowledgeBlock[] {
  if (disclosure.mode === "REPLACE_ENTRY") return [...disclosure.blocks];
  if (disclosure.mode === "APPEND_BLOCKS") return [...blocks, ...disclosure.blocks];
  if (!disclosure.anchorBlockId) throw new Error(`${disclosure.mode} requires an authored anchor block.`);
  const anchorIndex = blocks.findIndex((block) => block.knowledgeBaseBlockId === disclosure.anchorBlockId);
  if (anchorIndex < 0) throw new Error(`Knowledge disclosure anchor ${disclosure.anchorBlockId} is not visible.`);
  if (disclosure.mode === "INSERT_AFTER_BLOCK") {
    return [...blocks.slice(0, anchorIndex + 1), ...disclosure.blocks, ...blocks.slice(anchorIndex + 1)];
  }
  return [...blocks.slice(0, anchorIndex), ...disclosure.blocks, ...blocks.slice(anchorIndex + 1)];
}

export function projectKnowledgeDisclosures(
  baseBlocks: readonly KnowledgeBlock[],
  disclosures: readonly KnowledgeDisclosure[],
  capabilityState: ReadonlyMap<string, CapabilityStateEntry>,
  citations: CitationEvidence[],
  sources: SourceEvidence[],
): { blocks: KnowledgeBlock[]; footnotes: VisibleFootnote[] } {
  let blocks = [...baseBlocks];
  for (const disclosure of disclosures) {
    if (requirementMet(disclosure, capabilityState)) blocks = applyDisclosure(blocks, disclosure);
  }
  const projection = resolveVisibleKnowledge(
    blocks.map((block) => ({ citationIds: block.citationIds, content: block.content, visible: true })),
    citations,
    sources,
  );
  return { blocks, footnotes: projection.footnotes };
}
