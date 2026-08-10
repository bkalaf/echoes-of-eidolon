export interface SourceEvidence {
  authors: string[];
  sourceId: string;
  title: string;
}

export interface CitationEvidence {
  citationId: string;
  locator?: string | null;
  rendering: string;
  sourceId: string;
}

export interface KnowledgeSegment {
  citationIds: string[];
  content: string;
  visible: boolean;
}

export interface VisibleFootnote {
  citation: CitationEvidence;
  source: SourceEvidence;
}

function uniqueFirstUse(values: string[]): string[] {
  const seen = new Set<string>();
  return values.filter((value) => {
    if (seen.has(value)) return false;
    seen.add(value);
    return true;
  });
}

export function resolveVisibleKnowledge(segments: KnowledgeSegment[], citations: CitationEvidence[], sources: SourceEvidence[]): { content: string[]; footnotes: VisibleFootnote[] } {
  const visible = segments.filter((segment) => segment.visible);
  const citationById = new Map(citations.map((citation) => [citation.citationId, citation]));
  const sourceById = new Map(sources.map((source) => [source.sourceId, source]));
  const footnotes = uniqueFirstUse(visible.flatMap((segment) => segment.citationIds)).map((citationId) => {
    const citation = citationById.get(citationId);
    if (!citation) throw new Error(`Visible Citation ${citationId} is missing.`);
    const source = sourceById.get(citation.sourceId);
    if (!source) throw new Error(`Citation ${citationId} has no legitimate Source evidence.`);
    return { citation, source };
  });
  return { content: visible.map((segment) => segment.content), footnotes };
}

export function assertResearchEvidence(research: { citationId: string }, citations: CitationEvidence[], sources: SourceEvidence[]): void {
  resolveVisibleKnowledge([{ citationIds: [research.citationId], content: "", visible: true }], citations, sources);
}
