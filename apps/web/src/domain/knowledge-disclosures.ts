import {
  evaluateCapabilityCondition,
  type CapabilityCondition,
  type CapabilityDefinitionVersionContract,
  type CapabilityStateEntry,
} from "./capabilities";
import type { KnowledgeBaseBlockKind, KnowledgeBaseDisclosureMode } from "../generated/prisma/enums";
import { resolveVisibleKnowledge, type CitationEvidence, type SourceEvidence, type VisibleFootnote } from "./knowledge-evidence";

export interface KnowledgeBlock {
  knowledgeBaseBlockId: string;
  kind: KnowledgeBaseBlockKind;
  content: string;
  citationIds: string[];
}

export interface KnowledgeDisclosure {
  knowledgeBaseDisclosureId: string;
  condition: CapabilityCondition;
  mode: KnowledgeBaseDisclosureMode;
  anchorBlockId?: string | null;
  blocks: KnowledgeBlock[];
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
  capabilityDefinitions: ReadonlyMap<string, CapabilityDefinitionVersionContract>,
  citations: CitationEvidence[],
  sources: SourceEvidence[],
): { blocks: KnowledgeBlock[]; footnotes: VisibleFootnote[] } {
  let blocks = [...baseBlocks];
  for (const disclosure of disclosures) {
    if (evaluateCapabilityCondition(disclosure.condition, capabilityState, capabilityDefinitions)) {
      blocks = applyDisclosure(blocks, disclosure);
    }
  }
  const projection = resolveVisibleKnowledge(
    blocks.map((block) => ({ citationIds: block.citationIds, content: block.content, visible: true })),
    citations,
    sources,
  );
  return { blocks, footnotes: projection.footnotes };
}
